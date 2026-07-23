import { Controller, Get, Param, ParseEnumPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatMessageQueryDto } from './dto/chat-message-query.dto';
import { ChatMessageDto } from './dto/chat-message.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':chatType/message')
  @ApiOperation({
    summary: 'Лента уведомлений/алертов (Notification — раз в час, Alert — раз в минуту)',
  })
  @ApiOkResponse({ type: ChatMessageDto, isArray: true })
  findMessages(
    @Param('chatType', new ParseEnumPipe(ChatType)) chatType: ChatType,
    @Query() query: ChatMessageQueryDto,
  ) {
    return this.chatService.findMessages(chatType, query);
  }
}
