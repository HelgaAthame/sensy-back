import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { MediaFilesController } from './media-files.controller';
import { MediaFilesService } from './media-files.service';

@Module({
  imports: [AnalysisModule],
  controllers: [MediaFilesController],
  providers: [MediaFilesService],
})
export class MediaFilesModule {}
