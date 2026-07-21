import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export enum ChecklistScaleDto {
  Full = 'Full',
  Binary = 'Binary',
}

export class ApplyChecklistCriteriaDto {
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
  @IsNumber()
  score?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  help?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  comment?: string | null;

  @ApiPropertyOptional({ enum: ChecklistScaleDto })
  @IsOptional()
  @IsEnum(ChecklistScaleDto)
  scale?: ChecklistScaleDto;
}

export class ApplyChecklistBlockDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: [ApplyChecklistCriteriaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyChecklistCriteriaDto)
  criterias?: ApplyChecklistCriteriaDto[];
}

export class ApplyChecklistBodyDto {
  @ApiPropertyOptional({ type: [ApplyChecklistBlockDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyChecklistBlockDto)
  blocks?: ApplyChecklistBlockDto[];
}

export class ApplyChecklistQueryDto {
  @ApiProperty()
  @IsInt()
  @Type(() => Number)
  checklistId!: number;
}
