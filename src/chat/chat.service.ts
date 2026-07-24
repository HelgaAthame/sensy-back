import { Injectable } from '@nestjs/common';
import { ChatType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessageDto, ChatMessageQueryDto } from './dto/chat-message.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(chatType: ChatType, query: ChatMessageQueryDto): Promise<ChatMessageDto[]> {
    const where: Prisma.ChatMessageWhereInput = { chatType };
    if (query.start || query.end) {
      where.createDate = {
        ...(query.start ? { gte: new Date(query.start) } : {}),
        ...(query.end ? { lte: new Date(query.end) } : {}),
      };
    }

    const rows = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createDate: 'desc' },
      skip: query.offset ?? 0,
      take: query.limit ?? 20,
    });

    return rows.map((row) => this.mapMessage(row));
  }

  /** Системные триггеры (см. AnalysisProcessor/GptAnalysisService) и ручное создание используют один и тот же путь. */
  async create(chatType: ChatType, text: string): Promise<ChatMessageDto> {
    const chatId = (await this.prisma.chatMessage.count({ where: { chatType } })) + 1;
    const row = await this.prisma.chatMessage.create({
      data: { chatType, chatId, text },
    });
    return this.mapMessage(row);
  }

  private mapMessage(row: {
    id: number;
    chatId: number;
    createDate: Date;
    text: string | null;
    attachmentsCount: number;
    seen: boolean;
  }): ChatMessageDto {
    return {
      id: row.id,
      chatId: row.chatId,
      createDate: row.createDate.toISOString(),
      text: row.text,
      attachmentsCount: row.attachmentsCount,
      seen: row.seen,
    };
  }
}
