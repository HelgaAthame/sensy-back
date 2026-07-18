import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMediaFileQueryDto } from './dto/create-media-file-query.dto';
import { MediaFileQueryDto } from './dto/media-file-query.dto';
import { MediaFileDto, MediaFileListResponseDto } from './dto/media-file.dto';
import { MediaFilesService } from './media-files.service';

@ApiTags('mediafile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MediaFilesController {
  constructor(private readonly mediaFilesService: MediaFilesService) {}

  @Post('api/mediafile')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Загрузить запись звонка' })
  @ApiOkResponse({ type: MediaFileDto })
  @UseInterceptors(FileInterceptor('file'))
  create(@UploadedFile() file: Express.Multer.File, @Query() query: CreateMediaFileQueryDto) {
    return this.mediaFilesService.create(file, query);
  }

  @Get('api/v2/mediafile')
  @ApiOperation({ summary: 'Список звонков с пагинацией/фильтрами/сортировкой' })
  @ApiOkResponse({ type: MediaFileListResponseDto })
  findAll(@Query() query: MediaFileQueryDto) {
    return this.mediaFilesService.findAll(query);
  }

  @Get('api/mediafile/:id')
  @ApiOperation({ summary: 'Карточка звонка' })
  @ApiOkResponse({ type: MediaFileDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mediaFilesService.findOne(id);
  }

  @Get('api/mediafile/:id/stream')
  @ApiOperation({ summary: 'Аудиопоток записи' })
  async stream(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { stream, contentType, contentLength } = await this.mediaFilesService.getStream(id);
    res.set({
      'Content-Type': contentType ?? 'application/octet-stream',
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
    });
    stream.pipe(res);
  }
}
