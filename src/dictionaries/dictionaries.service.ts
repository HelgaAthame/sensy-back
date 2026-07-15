import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDictionaryDto, UpdateDictionaryDto } from './dto/dictionary.dto';

@Injectable()
export class DictionariesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapDictionary(dictionary: {
    id: number;
    name: string | null;
    isActive: boolean;
    type: string;
    colorHex: string;
    phrases: Prisma.JsonValue;
  }) {
    return {
      id: dictionary.id,
      name: dictionary.name,
      isActive: dictionary.isActive,
      type: dictionary.type,
      colorHex: dictionary.colorHex,
      data: { phrases: (dictionary.phrases as string[]) ?? [] },
    };
  }

  async findAll() {
    const dictionaries = await this.prisma.dictionary.findMany({ orderBy: { id: 'asc' } });
    return dictionaries.map((dictionary) => this.mapDictionary(dictionary));
  }

  async findOne(id: number) {
    const dictionary = await this.prisma.dictionary.findUnique({ where: { id } });
    if (!dictionary) {
      throw new NotFoundException(`Словарь с id=${id} не найден`);
    }
    return this.mapDictionary(dictionary);
  }

  async create(dto: CreateDictionaryDto) {
    const { projectIds, phrases, ...rest } = dto;
    const dictionary = await this.prisma.dictionary.create({
      data: {
        ...rest,
        phrases,
        dictionaryProjects: projectIds
          ? { create: projectIds.map((projectId) => ({ projectId })) }
          : undefined,
      },
    });
    return this.mapDictionary(dictionary);
  }

  async update(id: number, dto: UpdateDictionaryDto) {
    await this.findOne(id);
    const { projectIds, phrases, ...rest } = dto;

    if (projectIds) {
      await this.prisma.dictionaryProject.deleteMany({ where: { dictionaryId: id } });
    }

    const dictionary = await this.prisma.dictionary.update({
      where: { id },
      data: {
        ...rest,
        ...(phrases ? { phrases } : {}),
        dictionaryProjects: projectIds
          ? { create: projectIds.map((projectId) => ({ projectId })) }
          : undefined,
      },
    });
    return this.mapDictionary(dictionary);
  }
}
