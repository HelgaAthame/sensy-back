import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AudioService } from './audio.service';
import { complementIntervals, intersectIntervals, mergeIntervals } from './intervals';
import { KeywordSearchService } from './keyword-search.service';
import { SttChunkResult, SttService } from './stt.service';

export const MEDIA_ANALYSIS_QUEUE = 'media-analysis';

export interface MediaAnalysisJobData {
  mediaFileId: number;
}

@Injectable()
@Processor(MEDIA_ANALYSIS_QUEUE)
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audio: AudioService,
    private readonly stt: SttService,
    private readonly keywordSearch: KeywordSearchService,
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

      const channelResults = await Promise.all(
        Array.from({ length: channelCount }, (_, channel) => channel).map(async (channel) => {
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
          return { channel, sttResult, keywordMatches };
        }),
      );

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
      const keywordsSearchResult = channelResults.flatMap((result) => result.keywordMatches);
      const maxSimultaneousSilenceDuration = simultaneousSilenceRegions.reduce(
        (max, region) => Math.max(max, region.endTime - region.startTime),
        0,
      );

      const resultData = {
        stt: { text: fullText, chunks: sttChunks, regions: [] } as unknown as Prisma.InputJsonValue,
        simultaneousSpeech: { regions: simultaneousSpeechRegions } as unknown as Prisma.InputJsonValue,
        simultaneousSilence: { regions: simultaneousSilenceRegions } as unknown as Prisma.InputJsonValue,
        keywordsSearchResult: { regions: keywordsSearchResult } as unknown as Prisma.InputJsonValue,
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
