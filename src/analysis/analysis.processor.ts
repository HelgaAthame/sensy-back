import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { buildWorkerConnection } from '../redis-connection';
import { AudioService } from './audio.service';
import { complementIntervals, intersectIntervals, mergeIntervals, sumDuration } from './intervals';
import { KeywordMatch, KeywordSearchService } from './keyword-search.service';
import { SttChunkResult, SttService } from './stt.service';
import { TonalRegion, TonalService } from './tonal.service';

/** По телефонийной конвенции: канал 0 — оператор, канал 1 — клиент (см. keyword-search.service.ts). */
const OPERATOR_CHANNEL = 0;
const CLIENT_CHANNEL = 1;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function negativeLevel(regions: TonalRegion[]): number | null {
  const totalDuration = regions.reduce((sum, region) => sum + (region.endTime - region.startTime), 0);
  if (totalDuration === 0) return null;
  const weighted = regions.reduce(
    (sum, region) => sum + region.prob * (region.endTime - region.startTime),
    0,
  );
  return weighted / totalDuration;
}

function negativeSpeechWeightedDuration(regions: TonalRegion[]): number {
  return regions.reduce((sum, region) => sum + region.prob * (region.endTime - region.startTime), 0);
}

export const MEDIA_ANALYSIS_QUEUE = 'media-analysis';

export interface MediaAnalysisJobData {
  mediaFileId: number;
}

@Injectable()
@Processor(MEDIA_ANALYSIS_QUEUE, {
  // ONNX-инференс (Whisper + распознавание эмоций) синхронно блокирует event loop на минуты —
  // стандартный lockDuration BullMQ (30с) не успевает продлеваться, и job считается "зависшим"
  // и перезапускается повторно, хотя первый запуск ещё не закончился. Даём щедрый запас.
  lockDuration: 20 * 60 * 1000,
  // Отдельное, более терпеливое Redis-соединение для воркера — см. redis-connection.ts.
  connection: buildWorkerConnection(),
})
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audio: AudioService,
    private readonly stt: SttService,
    private readonly keywordSearch: KeywordSearchService,
    private readonly tonal: TonalService,
  ) {
    super();
  }

  async process(job: Job<MediaAnalysisJobData>): Promise<void> {
    const { mediaFileId } = job.data;
    this.logger.log(`Начинаю анализ звонка id=${mediaFileId}`);

    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id: mediaFileId },
      include: {
        project: { include: { dictionaryProjects: { include: { dictionary: true } } } },
      },
    });
    if (!mediaFile) {
      this.logger.warn(`MediaFile id=${mediaFileId} не найден, пропускаю анализ`);
      return;
    }

    const tempFiles: string[] = [];

    try {
      const sourcePath = await this.audio.downloadToTemp(mediaFile.storageKey);
      tempFiles.push(sourcePath);

      const channelCount = Math.min(Math.max(1, mediaFile.numChannels ?? 1), 2);

      const dictionaries = mediaFile.project
        ? mediaFile.project.dictionaryProjects.map((link) => link.dictionary)
        : await this.prisma.dictionary.findMany({ where: { isActive: true } });
      const activeDictionaries = dictionaries
        .filter((dictionary) => dictionary.isActive)
        .map((dictionary) => ({
          id: dictionary.id,
          name: dictionary.name,
          type: dictionary.type,
          phrases: (dictionary.phrases as string[] | null) ?? [],
        }));

      // Каналы обрабатываются последовательно, а не через Promise.all — на Render free tier
      // (512MB RAM) параллельная загрузка Whisper + SER-модели сразу для двух каналов
      // приводила к OOM. По той же причине сгруппировано по фазам (сначала STT для ВСЕХ
      // каналов, потом тональность для ВСЕХ каналов), а не чередованием по каналу — ML-worker
      // держит в памяти только одну модель за раз и выгружает предыдущую при переключении
      // типа задачи (см. ml.worker.ts), так дешевле: 2 переключения модели вместо 4.
      const channels = Array.from({ length: channelCount }, (_, index) => index);

      const sttPhase = [];
      for (const channel of channels) {
        const channelPath = await this.audio.splitChannel(sourcePath, channel);
        tempFiles.push(channelPath);
        const audioData = this.audio.readWavAsFloat32(channelPath);
        const sttResult = await this.stt.transcribeChannel(audioData, channel);
        const keywordMatches = this.keywordSearch.search(
          channel,
          sttResult.text,
          sttResult.chunks,
          activeDictionaries,
        );
        sttPhase.push({ channel, audioData, sttResult, keywordMatches });
      }

      const channelResults = [];
      for (const { channel, audioData, sttResult, keywordMatches } of sttPhase) {
        const tonalRegions = await this.tonal.classifyChunks(audioData, channel, sttResult.chunks);
        channelResults.push({ channel, sttResult, keywordMatches, tonalRegions });
      }

      const speechIntervalsByChannel = channelResults.map((result) =>
        mergeIntervals(result.sttResult.chunks.map((chunk) => ({ start: chunk.startTime, end: chunk.endTime }))),
      );

      let simultaneousSpeechRegions: {
        actorByChannel: number | null;
        actor: number;
        startTime: number;
        endTime: number;
      }[] = [];
      let simultaneousSilenceRegions: { startTime: number; endTime: number }[] = [];

      if (speechIntervalsByChannel.length === 2) {
        simultaneousSpeechRegions = intersectIntervals(
          speechIntervalsByChannel[0],
          speechIntervalsByChannel[1],
        ).map((overlap) => ({ actorByChannel: null, actor: 0, startTime: overlap.start, endTime: overlap.end }));

        const totalDuration =
          mediaFile.duration ??
          Math.max(
            speechIntervalsByChannel[0].at(-1)?.end ?? 0,
            speechIntervalsByChannel[1].at(-1)?.end ?? 0,
          );
        const allSpeech = [...speechIntervalsByChannel[0], ...speechIntervalsByChannel[1]];
        simultaneousSilenceRegions = complementIntervals(allSpeech, totalDuration).map((silence) => ({
          startTime: silence.start,
          endTime: silence.end,
        }));
      }

      const sttChunks: SttChunkResult[] = channelResults.flatMap((result) => result.sttResult.chunks);
      const fullText = channelResults.map((result) => result.sttResult.text).join(' ');
      const keywordsSearchResult: KeywordMatch[] = channelResults.flatMap((result) => result.keywordMatches);
      const tonalRegions: TonalRegion[] = channelResults.flatMap((result) => result.tonalRegions);
      const maxSimultaneousSilenceDuration = simultaneousSilenceRegions.reduce(
        (max, region) => Math.max(max, region.endTime - region.startTime),
        0,
      );

      const operatorTonal = tonalRegions.filter((region) => region.channel === OPERATOR_CHANNEL);
      const clientTonal = tonalRegions.filter((region) => region.channel === CLIENT_CHANNEL);
      const operatorSpeech = speechIntervalsByChannel[OPERATOR_CHANNEL] ?? [];
      const clientSpeech = speechIntervalsByChannel[CLIENT_CHANNEL] ?? [];
      const callDuration =
        mediaFile.duration ?? Math.max(...speechIntervalsByChannel.flat().map((interval) => interval.end), 0);
      const unionSpeech = mergeIntervals(speechIntervalsByChannel.flat());
      const totalSpeechOverall = sumDuration(unionSpeech);
      const simultaneousSpeechDurations = simultaneousSpeechRegions.map(
        (region) => region.endTime - region.startTime,
      );
      const simultaneousSilenceDurations = simultaneousSilenceRegions.map(
        (region) => region.endTime - region.startTime,
      );
      const negativeLevelOverall = negativeLevel(tonalRegions);

      const keywordsSearchCounter: Record<string, number> = {};
      for (const match of keywordsSearchResult) {
        const key = match.categoryName ?? String(match.category);
        keywordsSearchCounter[key] = (keywordsSearchCounter[key] ?? 0) + 1;
      }

      const summaryAnalyserResult = {
        simultaneousSpeechCount: simultaneousSpeechRegions.length,
        simultaneousSilenceCount: simultaneousSilenceRegions.length,
        maxSimultaneousSpeechDuration: simultaneousSpeechDurations.length
          ? Math.max(...simultaneousSpeechDurations)
          : null,
        maxSimultaneousSilenceDuration,
        averageSimultaneousSpeechDuration: average(simultaneousSpeechDurations),
        averageSimultaneousSilenceDuration: average(simultaneousSilenceDurations) ?? 0,
        keywordsSearchCounter,
        totalSpeechOverall,
        totalNonSpeechOverall: Math.max(0, callDuration - totalSpeechOverall),
        negativeLevelOverall: negativeLevelOverall ?? 0,
        totalSpeechDurationOperator: sumDuration(operatorSpeech),
        totalNonSpeechDurationOperator: Math.max(0, callDuration - sumDuration(operatorSpeech)),
        negativeSpeechWeightedDurationOperator: negativeSpeechWeightedDuration(operatorTonal),
        negativeLevelOperator: negativeLevel(operatorTonal),
        totalSpeechDurationClient: sumDuration(clientSpeech),
        totalNonSpeechDurationClient: Math.max(0, callDuration - sumDuration(clientSpeech)),
        negativeSpeechWeightedDurationClient: negativeSpeechWeightedDuration(clientTonal),
        negativeLevelClient: negativeLevel(clientTonal),
      };

      const resultData = {
        stt: { text: fullText, chunks: sttChunks, regions: [] } as unknown as Prisma.InputJsonValue,
        tonal: { regions: tonalRegions } as unknown as Prisma.InputJsonValue,
        simultaneousSpeech: { regions: simultaneousSpeechRegions } as unknown as Prisma.InputJsonValue,
        simultaneousSilence: { regions: simultaneousSilenceRegions } as unknown as Prisma.InputJsonValue,
        keywordsSearchResult: { regions: keywordsSearchResult } as unknown as Prisma.InputJsonValue,
        summaryAnalyserResult: summaryAnalyserResult as unknown as Prisma.InputJsonValue,
      };

      await this.prisma.mediaFileResult.upsert({
        where: { mediaFileId },
        create: { mediaFileId, ...resultData },
        update: resultData,
      });

      await this.prisma.mediaFile.update({
        where: { id: mediaFileId },
        data: {
          status: 'Ready',
          keywordsCount: keywordsSearchResult.length,
          maxSimultaneousSilenceDuration,
          simultaneousSpeechCount: simultaneousSpeechRegions.length,
          negativeLevelOverall,
        },
      });

      this.logger.log(`Анализ звонка id=${mediaFileId} завершён`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка анализа';
      this.logger.error(`Анализ звонка id=${mediaFileId} упал: ${message}`);
      await this.prisma.mediaFile.update({
        where: { id: mediaFileId },
        data: { status: 'Failed', isFailed: true, failureReason: message },
      });
    } finally {
      await this.audio.cleanup(tempFiles);
    }
  }
}
