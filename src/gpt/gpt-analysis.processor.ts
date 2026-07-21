import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GptAnalysisService } from './gpt-analysis.service';

export const GPT_ANALYSIS_QUEUE = 'gpt-analysis';

export interface GptAnalysisJobData {
  mediaFileId: number;
}

@Injectable()
@Processor(GPT_ANALYSIS_QUEUE)
export class GptAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(GptAnalysisProcessor.name);

  constructor(private readonly gptAnalysis: GptAnalysisService) {
    super();
  }

  async process(job: Job<GptAnalysisJobData>): Promise<void> {
    const { mediaFileId } = job.data;
    this.logger.log(`Начинаю GPT-анализ звонка id=${mediaFileId}`);
    try {
      await this.gptAnalysis.runAnalysis(mediaFileId);
    } catch (error) {
      this.logger.error(
        `GPT-анализ звонка id=${mediaFileId} упал: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
