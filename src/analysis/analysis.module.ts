import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatModule } from '../chat/chat.module';
import { AnalysisProcessor, MEDIA_ANALYSIS_QUEUE } from './analysis.processor';
import { AudioService } from './audio.service';
import { KeywordSearchService } from './keyword-search.service';
import { MlWorkerClientService } from './ml-worker-client.service';
import { SttService } from './stt.service';
import { TonalService } from './tonal.service';

@Module({
  imports: [BullModule.registerQueue({ name: MEDIA_ANALYSIS_QUEUE }), ChatModule],
  providers: [AnalysisProcessor, AudioService, SttService, KeywordSearchService, TonalService, MlWorkerClientService],
  exports: [BullModule],
})
export class AnalysisModule {}
