import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChecklistsService } from './checklists.service';
import {
  ChecklistDto,
  ChecklistFullDto,
  CreateChecklistDto,
  UpdateChecklistDto,
} from './dto/checklist.dto';

@ApiTags('checklists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/checklist')
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Get()
  @ApiOperation({ summary: 'Список чек-листов' })
  @ApiOkResponse({ type: ChecklistDto, isArray: true })
  findAll() {
    return this.checklistsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Чек-лист по id (с привязанными проектами)' })
  @ApiOkResponse({ type: ChecklistFullDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.checklistsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать чек-лист' })
  create(@Body() dto: CreateChecklistDto) {
    return this.checklistsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить чек-лист' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChecklistDto) {
    return this.checklistsService.update(id, dto);
  }

  @Post(':id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Клонировать чек-лист' })
  clone(@Param('id', ParseIntPipe) id: number) {
    return this.checklistsService.clone(id);
  }
}
