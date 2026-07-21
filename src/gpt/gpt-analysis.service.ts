import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessage, GroqClient } from './groq.client';

interface SttChunkLike {
  channel: number;
  startTime: number;
  text: string;
}

interface CriteriaTemplate {
  name: string;
  minScore?: number;
  maxScore?: number;
  help?: string | null;
  scale?: 'Full' | 'Binary';
}

interface BlockTemplate {
  name: string;
  criterias?: CriteriaTemplate[];
}

interface ChecklistTemplateData {
  name?: string | null;
  blocks?: BlockTemplate[];
}

interface ScoredCriteria extends CriteriaTemplate {
  minScore: number;
  maxScore: number;
  score: number;
  comment: string | null;
}

interface ScoredBlock {
  name: string;
  minScore: number;
  maxScore: number;
  score: number;
  criterias: ScoredCriteria[];
}

interface ScoredChecklistItem {
  id: number;
  name: string | null;
  minScore: number;
  maxScore: number;
  score: number;
  blocks: ScoredBlock[];
}

function formatTranscript(chunks: SttChunkLike[]): string {
  return [...chunks]
    .sort((a, b) => a.startTime - b.startTime)
    .map((chunk) => {
      const speaker = chunk.channel === 0 ? 'Оператор' : 'Клиент';
      return `[${speaker}] ${chunk.text.trim()}`;
    })
    .filter((line) => line.length > 'Оператор'.length + 3)
    .join('\n');
}

@Injectable()
export class GptAnalysisService {
  private readonly logger = new Logger(GptAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly groq: GroqClient,
  ) {}

  async runAnalysis(mediaFileId: number): Promise<void> {
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id: mediaFileId },
      include: {
        result: true,
        project: { include: { checklistProjects: { include: { checklist: true } } } },
      },
    });
    if (!mediaFile) {
      throw new NotFoundException(`Звонок с id=${mediaFileId} не найден`);
    }

    const stt = mediaFile.result?.stt as { chunks?: SttChunkLike[] } | null;
    const transcript = formatTranscript(stt?.chunks ?? []);
    if (!transcript) {
      this.logger.warn(`Звонок id=${mediaFileId}: пустая расшифровка, GPT-анализ пропущен`);
      return;
    }

    const summaryPromise = this.generateSummary(transcript);

    const checklists = mediaFile.project?.checklistProjects.map((link) => link.checklist) ?? [];
    const checklistPromises = checklists
      .filter((checklist) => checklist.isActive && checklist.data)
      .map((checklist) => this.scoreChecklist(checklist.id, checklist.data as unknown as ChecklistTemplateData, transcript));

    const [summary, ...scoredChecklists] = await Promise.all([summaryPromise, ...checklistPromises]);

    await this.prisma.mediaFileResult.upsert({
      where: { mediaFileId },
      create: { mediaFileId, gptSummary: summary },
      update: { gptSummary: summary },
    });

    for (const item of scoredChecklists) {
      if (!item) continue;
      await this.prisma.mediaFileChecklist.upsert({
        where: { mediaFileId_checklistId: { mediaFileId, checklistId: item.id } },
        create: { mediaFileId, checklistId: item.id, data: item as unknown as Prisma.InputJsonValue },
        update: { data: item as unknown as Prisma.InputJsonValue },
      });
    }

    this.logger.log(`GPT-анализ звонка id=${mediaFileId} завершён (чек-листов: ${scoredChecklists.filter(Boolean).length})`);
  }

  private async generateSummary(transcript: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Ты аналитик контроля качества звонков колл-центра. Кратко (3-5 предложений) на русском языке резюмируй суть разговора между оператором и клиентом: тема обращения, что предложил оператор, чем закончился разговор. Без markdown-разметки, обычный текст.',
      },
      { role: 'user', content: transcript },
    ];
    try {
      const result = await this.groq.completeText(messages);
      return result.trim();
    } catch (error) {
      this.logger.error(`Не удалось сгенерировать GPT-саммари: ${error instanceof Error ? error.message : error}`);
      return '';
    }
  }

  private async scoreChecklist(
    checklistId: number,
    template: ChecklistTemplateData,
    transcript: string,
  ): Promise<ScoredChecklistItem | null> {
    const blocks = template.blocks ?? [];
    if (blocks.length === 0) return null;

    const templateForPrompt = blocks.map((block) => ({
      name: block.name,
      criterias: (block.criterias ?? []).map((criteria) => ({
        name: criteria.name,
        minScore: criteria.minScore ?? 0,
        maxScore: criteria.maxScore ?? 1,
        scale: criteria.scale ?? 'Full',
        help: criteria.help ?? undefined,
      })),
    }));

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Ты оцениваешь качество звонка оператора колл-центра по чек-листу критериев. ' +
          'Для каждого критерия выставь числовую оценку score в диапазоне [minScore, maxScore] ' +
          '(при scale="Binary" — только minScore либо maxScore) и короткий комментарий comment на русском, ' +
          'объясняющий оценку по фактам из разговора. Верни СТРОГО JSON вида ' +
          '{"blocks":[{"name":"...","criterias":[{"name":"...","score":number,"comment":"..."}]}]}, ' +
          'без пояснений вне JSON. Названия блоков/критериев должны точно совпадать с шаблоном.\n\n' +
          `Шаблон чек-листа:\n${JSON.stringify(templateForPrompt)}`,
      },
      { role: 'user', content: `Расшифровка звонка:\n${transcript}` },
    ];

    let parsed: { blocks?: { name: string; criterias?: { name: string; score?: number; comment?: string }[] }[] };
    try {
      const raw = await this.groq.completeJson(messages);
      parsed = JSON.parse(raw);
    } catch (error) {
      this.logger.error(
        `Не удалось получить оценку чек-листа id=${checklistId} от Groq: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }

    const scoredBlocks: ScoredBlock[] = blocks.map((blockTemplate) => {
      const gptBlock = parsed.blocks?.find((block) => block.name === blockTemplate.name);
      const scoredCriterias: ScoredCriteria[] = (blockTemplate.criterias ?? []).map((criteriaTemplate) => {
        const minScore = criteriaTemplate.minScore ?? 0;
        const maxScore = criteriaTemplate.maxScore ?? 1;
        const gptCriteria = gptBlock?.criterias?.find((criteria) => criteria.name === criteriaTemplate.name);
        const rawScore = gptCriteria?.score ?? minScore;
        const score = Math.min(maxScore, Math.max(minScore, rawScore));
        return {
          name: criteriaTemplate.name,
          minScore,
          maxScore,
          score,
          help: criteriaTemplate.help ?? null,
          scale: criteriaTemplate.scale ?? 'Full',
          comment: gptCriteria?.comment ?? null,
        };
      });
      return {
        name: blockTemplate.name,
        minScore: scoredCriterias.reduce((sum, c) => sum + c.minScore, 0),
        maxScore: scoredCriterias.reduce((sum, c) => sum + c.maxScore, 0),
        score: scoredCriterias.reduce((sum, c) => sum + c.score, 0),
        criterias: scoredCriterias,
      };
    });

    return {
      id: checklistId,
      name: template.name ?? null,
      minScore: scoredBlocks.reduce((sum, b) => sum + b.minScore, 0),
      maxScore: scoredBlocks.reduce((sum, b) => sum + b.maxScore, 0),
      score: scoredBlocks.reduce((sum, b) => sum + b.score, 0),
      blocks: scoredBlocks,
    };
  }
}
