import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateMediaFileQueryDto {
  @ApiProperty()
  @IsISO8601()
  createDate!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  clientNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  operatorId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  projectId?: number;
}
