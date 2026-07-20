import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnalysisProcessor, MEDIA_ANALYSIS_QUEUE } from './analysis.processor';
import { AudioService } from './audio.service';
import { KeywordSearchService } from './keyword-search.service';
import { SttService } from './stt.service';

@Module({
  imports: [BullModule.registerQueue({ name: MEDIA_ANALYSIS_QUEUE })],
  providers: [AnalysisProcessor, AudioService, SttService, KeywordSearchService],
  exports: [BullModule],
})
export class AnalysisModule {}
