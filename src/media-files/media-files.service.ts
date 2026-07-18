import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateMediaFileQueryDto } from './dto/create-media-file-query.dto';
import { MediaFileQueryDto } from './dto/media-file-query.dto';
import { MediaFileDto, MediaFileListResponseDto } from './dto/media-file.dto';

interface ProbedMetadata {
  numChannels: number | null;
  sampleRate: number | null;
  duration: number | null;
}

const mediaFileInclude = {
  operator: true,
  project: true,
} as const;

type MediaFileRow = Prisma.MediaFileGetPayload<{ include: typeof mediaFileInclude }>;

@Injectable()
export class MediaFilesService {
  private readonly logger = new Logger(MediaFilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async probeMetadata(filePath: string): Promise<ProbedMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        const audioStream = data.streams.find((stream) => stream.codec_type === 'audio');
        resolve({
          numChannels: audioStream?.channels ?? null,
          sampleRate: audioStream?.sample_rate ? Number(audioStream.sample_rate) : null,
          duration: data.format.duration ? Number(data.format.duration) : null,
        });
      });
    });
  }

  async create(file: Express.Multer.File, query: CreateMediaFileQueryDto): Promise<MediaFileDto> {
    const storageKey = `mediafiles/${randomUUID()}-${file.originalname}`;
    const tempFilePath = path.join(os.tmpdir(), `${randomUUID()}-${file.originalname}`);

    let metadata: ProbedMetadata = { numChannels: null, sampleRate: null, duration: null };
    let isFailed = false;
    let failureReason: string | null = null;

    try {
      await fs.writeFile(tempFilePath, file.buffer);
      metadata = await this.probeMetadata(tempFilePath);
    } catch (error) {
      isFailed = true;
      failureReason = error instanceof Error ? error.message : 'Не удалось прочитать метаданные файла';
      this.logger.warn(`Не удалось извлечь метаданные из ${file.originalname}: ${failureReason}`);
    } finally {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }

    await this.storage.upload(storageKey, file.buffer, file.mimetype);

    const row = await this.prisma.mediaFile.create({
      data: {
        fileName: file.originalname,
        storageKey,
        numChannels: metadata.numChannels,
        sampleRate: metadata.sampleRate,
        duration: metadata.duration,
        operatorId: query.operatorId,
        projectId: query.projectId,
        createDate: new Date(query.createDate),
        clientNumber: query.clientNumber,
        status: isFailed ? 'Failed' : 'Ready',
        isFailed,
        failureReason,
      },
      include: mediaFileInclude,
    });

    return this.mapMediaFile(row);
  }

  async findAll(query: MediaFileQueryDto): Promise<MediaFileListResponseDto> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 10;

    const where: Prisma.MediaFileWhereInput = {};

    if (query.start || query.end) {
      where.createDate = {
        ...(query.start ? { gte: new Date(query.start) } : {}),
        ...(query.end ? { lte: new Date(query.end) } : {}),
      };
    }
    if (query.operatorId) {
      where.operatorId = query.operatorId;
    }
    if (query.searchPhrase) {
      where.OR = [
        { fileName: { contains: query.searchPhrase, mode: 'insensitive' } },
        { clientNumber: { contains: query.searchPhrase, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.MediaFileOrderByWithRelationInput[] = [];
    if (query.orderByDescOperatorName) orderBy.push({ operator: { name: 'desc' } });
    if (query.orderByDescCreateDate) orderBy.push({ createDate: 'desc' });
    if (query.orderByDescClientNumber) orderBy.push({ clientNumber: 'desc' });
    if (query.orderByDescDuration) orderBy.push({ duration: 'desc' });
    if (query.orderByDescNegativeLevel) orderBy.push({ negativeLevelOverall: 'desc' });
    if (query.orderByDescPhrasesCount) orderBy.push({ keywordsCount: 'desc' });
    if (query.orderByDescMaxSimultaneousSilence) orderBy.push({ maxSimultaneousSilenceDuration: 'desc' });
    if (query.orderByDescSimultaneousSpeechCount) orderBy.push({ simultaneousSpeechCount: 'desc' });
    if (orderBy.length === 0) orderBy.push({ createDate: 'desc' });

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.mediaFile.findMany({
        where,
        include: mediaFileInclude,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.mediaFile.count({ where }),
    ]);

    return {
      totalCount,
      mediaFile: rows.map((row) => this.mapMediaFile(row)),
    };
  }

  async findOne(id: number): Promise<MediaFileDto> {
    const row = await this.prisma.mediaFile.findUnique({ where: { id }, include: mediaFileInclude });
    if (!row) {
      throw new NotFoundException(`Звонок с id=${id} не найден`);
    }
    await this.prisma.mediaFile.update({ where: { id }, data: { lastAccessUtc: new Date() } });
    return this.mapMediaFile(row);
  }

  async getStream(id: number) {
    const row = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Звонок с id=${id} не найден`);
    }
    return this.storage.getObjectStream(row.storageKey);
  }

  private mapMediaFile(row: MediaFileRow): MediaFileDto {
    return {
      id: row.id,
      fileName: row.fileName,
      totalCount: 0,
      numChannels: row.numChannels ?? 0,
      sampleRate: row.sampleRate ?? 0,
      duration: row.duration ?? 0,
      operatorId: row.operatorId,
      operatorName: row.operator?.name ?? null,
      operatorChannel: null,
      lastAccessUtc: row.lastAccessUtc.toISOString(),
      createDate: row.createDate.toISOString(),
      isFailed: row.isFailed,
      projectName: row.project?.name ?? null,
      additionalMetadata: {
        outerId: row.outerId,
        clientId: row.clientId,
        clientNumber: row.clientNumber,
        direction: row.direction,
      },
      summaryAnalyserResult: {
        simultaneousSpeechCount: row.simultaneousSpeechCount,
        simultaneousSilenceCount: 0,
        maxSimultaneousSpeechDuration: null,
        maxSimultaneousSilenceDuration: row.maxSimultaneousSilenceDuration ?? 0,
        averageSimultaneousSpeechDuration: null,
        averageSimultaneousSilenceDuration: 0,
        keywordsSearchCounter: {},
        totalSpeechOverall: 0,
        totalNonSpeechOverall: 0,
        negativeLevelOverall: row.negativeLevelOverall ?? 0,
        totalSpeechDurationOperator: null,
        totalNonSpeechDurationOperator: null,
        negativeSpeechWeightedDurationOperator: null,
        negativeLevelOperator: null,
        totalSpeechDurationClient: null,
        totalNonSpeechDurationClient: null,
        negativeSpeechWeightedDurationClient: null,
        negativeLevelClient: null,
      },
      filteredKeywordsCount: row.keywordsCount ?? 0,
      gptSummary: '',
      gptChecklist: null,
    };
  }
}
