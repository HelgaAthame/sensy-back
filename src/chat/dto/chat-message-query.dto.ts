import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional } from 'class-validator';

export class ChatMessageQueryDto {
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

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 50;
}
