import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

const projectInclude = {
  dictionaryProjects: { include: { dictionary: true, project: true } },
  checklistProjects: { include: { checklist: true, project: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapProject(project: {
    id: number;
    name: string | null;
    isActive: boolean;
    dictionaryProjects: { dictionaryId: number; dictionary: { name: string | null } }[];
    checklistProjects: { checklistId: number; checklist: { name: string | null } }[];
  }) {
    return {
      id: project.id,
      name: project.name,
      isActive: project.isActive,
      vocabularyProjects: project.dictionaryProjects.map((link) => ({
        vocabularyId: link.dictionaryId,
        vocabularyName: link.dictionary.name,
        projectId: project.id,
        projectName: project.name,
      })),
      checklistProjects: project.checklistProjects.map((link) => ({
        checklistId: link.checklistId,
        checklistName: link.checklist.name,
        projectId: project.id,
        projectName: project.name,
      })),
    };
  }

  async findAll() {
    const projects = await this.prisma.project.findMany({
      include: projectInclude,
      orderBy: { id: 'asc' },
    });
    return projects.map((project) => this.mapProject(project));
  }

  async findOne(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: projectInclude,
    });
    if (!project) {
      throw new NotFoundException(`Проект с id=${id} не найден`);
    }
    return this.mapProject(project);
  }

  async create(dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: { name: dto.name, isActive: dto.isActive ?? true },
    });
    return this.findOne(project.id);
  }

  async update(id: number, dto: UpdateProjectDto) {
    await this.findOne(id);
    await this.prisma.project.update({ where: { id }, data: dto });
    return this.findOne(id);
  }
}
