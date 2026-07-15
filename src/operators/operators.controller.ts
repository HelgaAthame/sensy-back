import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOperatorDto, OperatorDto, UpdateOperatorDto } from './dto/operator.dto';
import { OperatorsService } from './operators.service';

@ApiTags('operators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/operator')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  @Get()
  @ApiOperation({ summary: 'Список операторов' })
  @ApiOkResponse({ type: OperatorDto, isArray: true })
  findAll() {
    return this.operatorsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Оператор по id' })
  @ApiOkResponse({ type: OperatorDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.operatorsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать оператора' })
  create(@Body() dto: CreateOperatorDto) {
    return this.operatorsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить оператора' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOperatorDto) {
    return this.operatorsService.update(id, dto);
  }
}
