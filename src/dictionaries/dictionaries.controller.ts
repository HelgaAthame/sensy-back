import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDictionaryDto, DictionaryDto, UpdateDictionaryDto } from './dto/dictionary.dto';
import { DictionariesService } from './dictionaries.service';

@ApiTags('dictionaries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/vocabulary')
export class DictionariesController {
  constructor(private readonly dictionariesService: DictionariesService) {}

  @Get()
  @ApiOperation({ summary: 'Список словарей' })
  @ApiOkResponse({ type: DictionaryDto, isArray: true })
  findAll() {
    return this.dictionariesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Словарь по id' })
  @ApiOkResponse({ type: DictionaryDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dictionariesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать словарь' })
  create(@Body() dto: CreateDictionaryDto) {
    return this.dictionariesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить словарь' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDictionaryDto) {
    return this.dictionariesService.update(id, dto);
  }
}
