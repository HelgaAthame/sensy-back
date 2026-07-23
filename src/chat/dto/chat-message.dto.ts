import { ApiProperty } from '@nestjs/swagger';

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
