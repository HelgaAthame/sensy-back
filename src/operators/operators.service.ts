import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/operator.dto';

@Injectable()
export class OperatorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.operator.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number) {
    const operator = await this.prisma.operator.findUnique({ where: { id } });
    if (!operator) {
      throw new NotFoundException(`Оператор с id=${id} не найден`);
    }
    return operator;
  }

  create(dto: CreateOperatorDto) {
    return this.prisma.operator.create({ data: dto });
  }

  async update(id: number, dto: UpdateOperatorDto) {
    await this.findOne(id);
    return this.prisma.operator.update({ where: { id }, data: dto });
  }
}
