import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardResponseDto, OperatorRatingDataItemDto } from './dto/dashboard-response.dto';

interface KeywordMatchLike {
  category: number;
  phrase: string | null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function negativeHistogramBucket(level: number): string {
  const bucket = Math.min(9, Math.max(0, Math.floor(level * 10)));
  return (bucket / 10).toFixed(1);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(query: DashboardQueryDto): Promise<DashboardResponseDto> {
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

    const rows = await this.prisma.mediaFile.findMany({
      where,
      include: {
        operator: true,
        result: { select: { keywordsSearchResult: true } },
      },
    });

    const negativeLevelThreshold = query.negativeLevelThreshold ?? 0.3;

    const summaryData = {
      recordsCount: rows.length,
      averageDuration: average(rows.map((row) => row.duration ?? 0)),
      averageNegativeLevelOverall: average(rows.map((row) => row.negativeLevelOverall ?? 0)),
      averageKeywordsCount: average(rows.map((row) => row.keywordsCount ?? 0)),
      averageMaxSimultaneousSilenceDuration: average(rows.map((row) => row.maxSimultaneousSilenceDuration ?? 0)),
      averageSimultaneousSpeechCount: average(rows.map((row) => row.simultaneousSpeechCount ?? 0)),
    };

    const plotData = rows.map((row) => ({
      dateTime: row.createDate.toISOString(),
      keywordsExceedCount: row.keywordsCount ?? 0,
      maxSilenceDurationExceedCount: row.maxSimultaneousSilenceDuration ?? 0,
      negativeLevelExceedCount: (row.negativeLevelOverall ?? 0) >= negativeLevelThreshold ? 1 : 0,
      simultaneousSpeechExceedCount: row.simultaneousSpeechCount ?? 0,
    }));

    const negativeHistogramData: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      negativeHistogramData[(i / 10).toFixed(1)] = 0;
    }
    for (const row of rows) {
      if (row.negativeLevelOverall === null) continue;
      const bucket = negativeHistogramBucket(row.negativeLevelOverall);
      negativeHistogramData[bucket] = (negativeHistogramData[bucket] ?? 0) + 1;
    }

    const operatorGroups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.operatorId !== null ? String(row.operatorId) : `unassigned:${row.id}`;
      const group = operatorGroups.get(key);
      if (group) {
        group.push(row);
      } else {
        operatorGroups.set(key, [row]);
      }
    }
    const allOperatorRatings: OperatorRatingDataItemDto[] = Array.from(operatorGroups.values())
      .map((group) => ({
        operatorName: group[0].operator?.name ?? null,
        recordsCount: group.length,
        averageDuration: average(group.map((row) => row.duration ?? 0)),
        averageNegativeLevelOverall: average(group.map((row) => row.negativeLevelOverall ?? 0)),
        averageKeywordsCount: average(group.map((row) => row.keywordsCount ?? 0)),
        averageMaxSimultaneousSilenceDuration: average(
          group.map((row) => row.maxSimultaneousSilenceDuration ?? 0),
        ),
        averageSimultaneousSpeechCount: average(group.map((row) => row.simultaneousSpeechCount ?? 0)),
      }))
      .sort((a, b) => b.recordsCount - a.recordsCount);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 10;
    const operatorRatingData = allOperatorRatings.slice(offset, offset + limit);

    const allowedCategories = query.filterByPhrasesCategoriesCommaSeparated
      ? new Set(
          query.filterByPhrasesCategoriesCommaSeparated
            .split(',')
            .map((id) => Number(id.trim()))
            .filter((id) => !Number.isNaN(id)),
        )
      : null;

    const phraseCounts = new Map<string, number>();
    for (const row of rows) {
      const matches = (row.result?.keywordsSearchResult as { regions?: KeywordMatchLike[] } | null)?.regions ?? [];
      for (const match of matches) {
        if (!match.phrase) continue;
        if (allowedCategories && !allowedCategories.has(match.category)) continue;
        phraseCounts.set(match.phrase, (phraseCounts.get(match.phrase) ?? 0) + 1);
      }
    }
    const topNKeywords = query.topNKeywords ?? 5;
    const keywordsFrequencyData: Record<string, number> = Object.fromEntries(
      Array.from(phraseCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topNKeywords),
    );

    return {
      keywordsFrequencyData,
      messageText: '',
      plotData,
      negativeHistogramData,
      summaryData,
      operatorRatingData,
    };
  }
}
