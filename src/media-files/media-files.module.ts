import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { GptModule } from '../gpt/gpt.module';
import { MediaFilesController } from './media-files.controller';
import { MediaFilesService } from './media-files.service';

@Module({
  imports: [AnalysisModule, GptModule],
  controllers: [MediaFilesController],
  providers: [MediaFilesService],
})
export class MediaFilesModule {}
