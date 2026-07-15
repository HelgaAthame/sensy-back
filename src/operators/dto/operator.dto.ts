import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class OperatorDto {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;
}

export class CreateOperatorDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string | null;
}

export class UpdateOperatorDto extends PartialType(CreateOperatorDto) {}
