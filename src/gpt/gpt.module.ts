import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatModule } from '../chat/chat.module';
import { GptAnalysisProcessor, GPT_ANALYSIS_QUEUE } from './gpt-analysis.processor';
import { GptAnalysisService } from './gpt-analysis.service';
import { GroqClient } from './groq.client';

@Module({
  imports: [BullModule.registerQueue({ name: GPT_ANALYSIS_QUEUE }), ChatModule],
  providers: [GptAnalysisProcessor, GptAnalysisService, GroqClient],
  exports: [BullModule],
})
export class GptModule {}
