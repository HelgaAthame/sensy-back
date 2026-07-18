import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true';

export class MediaFileQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  start?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  end?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  operatorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  searchPhrase?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filterByPhrasesCategoriesCommaSeparated?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  orderByDescOperatorName?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  orderByDescCreateDate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  orderByDescClientNumber?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  orderByDescDuration?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  orderByDescNegativeLevel?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  orderByDescPhrasesCount?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  orderByDescMaxSimultaneousSilence?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  orderByDescSimultaneousSpeechCount?: boolean;
}
