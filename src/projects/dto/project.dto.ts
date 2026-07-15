import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

class ProjectDictionaryLinkDto {
  @ApiProperty({ nullable: true })
  vocabularyName!: string | null;

  @ApiProperty()
  vocabularyId!: number;

  @ApiProperty({ nullable: true })
  projectName!: string | null;

  @ApiProperty()
  projectId!: number;
}

class ProjectChecklistLinkDto {
  @ApiProperty({ nullable: true })
  checklistName!: string | null;

  @ApiProperty()
  checklistId!: number;

  @ApiProperty({ nullable: true })
  projectName!: string | null;

  @ApiProperty()
  projectId!: number;
}

export class ProjectDto {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ type: [ProjectDictionaryLinkDto] })
  vocabularyProjects?: ProjectDictionaryLinkDto[];

  @ApiPropertyOptional({ type: [ProjectChecklistLinkDto] })
  checklistProjects?: ProjectChecklistLinkDto[];
}

export class CreateProjectDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
