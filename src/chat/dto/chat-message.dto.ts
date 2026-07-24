import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 20;
}

export class CreateChatMessageDto {
  @ApiProperty()
  @IsString()
  text!: string;
}

export class ChatMessageDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  chatId!: number;

  @ApiProperty()
  createDate!: string;

  @ApiProperty({ nullable: true })
  text!: string | null;

  @ApiProperty()
  attachmentsCount!: number;

  @ApiProperty()
  seen!: boolean;
}
