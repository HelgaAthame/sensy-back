import { Injectable } from '@nestjs/common';
import { ChatType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessageQueryDto } from './dto/chat-message-query.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async findMessages(chatType: ChatType, query: ChatMessageQueryDto) {
    const hasDateFilter = Boolean(query.start || query.end);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        chatType,
        ...(hasDateFilter
          ? {
              createDate: {
                gte: query.start ? new Date(query.start) : undefined,
                lte: query.end ? new Date(query.end) : undefined,
              },
            }
          : {}),
      },
      orderBy: { createDate: 'desc' },
      skip: query.offset ?? 0,
      take: query.limit ?? 50,
    });

    return messages.map((message) => ({
      id: message.id,
      chatId: message.chatId,
      createDate: message.createDate.toISOString(),
      text: message.text,
      attachmentsCount: message.attachmentsCount,
      seen: message.seen,
    }));
  }
}
