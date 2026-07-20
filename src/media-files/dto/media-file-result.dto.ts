import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class MediaFileResultQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  negativeProbThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  simultaneousSilenceDurationThreshold?: number;
}

export class MediaFileIdParamDto {
  @ApiProperty()
  @IsInt()
  @Type(() => Number)
  id!: number;
}

export class MediaFileResultDto {
  @ApiPropertyOptional({ nullable: true })
  gptSummary!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  gptChecklist!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  stt!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  tonal!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  simultaneousSpeech!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  simultaneousSilence!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  keywordsSearchResult!: Record<string, unknown> | null;
}
