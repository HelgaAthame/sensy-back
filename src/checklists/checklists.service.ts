import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistDto, UpdateChecklistDto } from './dto/checklist.dto';

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const checklists = await this.prisma.checklist.findMany({
      include: { checklistProjects: true },
      orderBy: { id: 'asc' },
    });
    return checklists.map((checklist) => ({
      id: checklist.id,
      name: checklist.name,
      isActive: checklist.isActive,
      data: checklist.data,
      projectIds: checklist.checklistProjects.map((link) => link.projectId),
    }));
  }

  async findOne(id: number) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id },
      include: { checklistProjects: { include: { project: true } } },
    });
    if (!checklist) {
      throw new NotFoundException(`Чек-лист с id=${id} не найден`);
    }
    return {
      id: checklist.id,
      name: checklist.name,
      isActive: checklist.isActive,
      data: checklist.data,
      checklistProjects: checklist.checklistProjects.map((link) => ({
        projectId: link.projectId,
        projectName: link.project.name,
      })),
    };
  }

  async create(dto: CreateChecklistDto) {
    const checklist = await this.prisma.checklist.create({
      data: {
        name: dto.name,
        checklistProjects: dto.projectIds
          ? { create: dto.projectIds.map((projectId) => ({ projectId })) }
          : undefined,
      },
    });
    return checklist;
  }

  async update(id: number, dto: UpdateChecklistDto) {
    await this.findOne(id);
    const { projectIds, data, ...rest } = dto;

    if (projectIds) {
      await this.prisma.checklistProject.deleteMany({ where: { checklistId: id } });
    }

    return this.prisma.checklist.update({
      where: { id },
      data: {
        ...rest,
        ...(data ? { data: data as unknown as Prisma.InputJsonValue } : {}),
        checklistProjects: projectIds
          ? { create: projectIds.map((projectId) => ({ projectId })) }
          : undefined,
      },
    });
  }

  async clone(id: number) {
    const source = await this.prisma.checklist.findUnique({
      where: { id },
      include: { checklistProjects: true },
    });
    if (!source) {
      throw new NotFoundException(`Чек-лист с id=${id} не найден`);
    }

    return this.prisma.checklist.create({
      data: {
        name: source.name ? `${source.name} (копия)` : null,
        isActive: source.isActive,
        ...(source.data !== null
          ? { data: source.data as unknown as Prisma.InputJsonValue }
          : {}),
        checklistProjects: {
          create: source.checklistProjects.map((link) => ({ projectId: link.projectId })),
        },
      },
    });
  }
}
