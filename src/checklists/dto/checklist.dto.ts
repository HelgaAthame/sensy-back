import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum ChecklistScaleDto {
  Full = 'Full',
  Binary = 'Binary',
}

export class ChecklistCriteriaDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxScore?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  help?: string | null;

  @ApiPropertyOptional({ enum: ChecklistScaleDto })
  @IsOptional()
  @IsEnum(ChecklistScaleDto)
  scale?: ChecklistScaleDto;
}

export class ChecklistBlockDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: [ChecklistCriteriaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistCriteriaDto)
  criterias?: ChecklistCriteriaDto[];
}

export class ChecklistDataDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: [ChecklistBlockDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistBlockDto)
  blocks?: ChecklistBlockDto[];
}

export class ChecklistDto {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ nullable: true })
  data!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: [Number] })
  projectIds?: number[];
}

class ChecklistProjectLinkDto {
  @ApiProperty({ nullable: true })
  projectName!: string | null;

  @ApiProperty({ nullable: true })
  projectId!: number | null;
}

export class ChecklistFullDto {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ nullable: true })
  data!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: [ChecklistProjectLinkDto], nullable: true })
  checklistProjects!: ChecklistProjectLinkDto[] | null;
}

export class CreateChecklistDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  projectIds?: number[];
}

export class UpdateChecklistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  projectIds?: number[];

  @ApiPropertyOptional({ type: ChecklistDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChecklistDataDto)
  data?: ChecklistDataDto;
}
