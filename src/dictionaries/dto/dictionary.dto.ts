import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export enum DictionaryTypeDto {
  All = 'All',
  OnlyOperator = 'OnlyOperator',
  OnlyClient = 'OnlyClient',
  Hotwords = 'Hotwords',
}

export class DictionaryDto {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ enum: DictionaryTypeDto })
  type!: DictionaryTypeDto;

  @ApiProperty()
  colorHex!: string;

  @ApiProperty({ nullable: true })
  data!: { phrases: string[] } | null;
}

export class CreateDictionaryDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ enum: DictionaryTypeDto })
  @IsEnum(DictionaryTypeDto)
  type!: DictionaryTypeDto;

  @ApiProperty()
  @IsString()
  colorHex!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  phrases!: string[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'id проектов, к которым привязан словарь',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  projectIds?: number[];
}

export class UpdateDictionaryDto extends PartialType(CreateDictionaryDto) {}
