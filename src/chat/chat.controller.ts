import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatMessageDto, ChatMessageQueryDto, CreateChatMessageDto } from './dto/chat-message.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/chat/:chatType/message')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Лента уведомлений (Notification) или алертов (Alert)' })
  @ApiOkResponse({ type: [ChatMessageDto] })
  findAll(
    @Param('chatType', new ParseEnumPipe(ChatType)) chatType: ChatType,
    @Query() query: ChatMessageQueryDto,
  ) {
    return this.chatService.findAll(chatType, query);
  }

  @Post()
  @ApiOperation({ summary: 'Ручное создание сообщения в ленте (административное объявление)' })
  @ApiOkResponse({ type: ChatMessageDto })
  create(
    @Param('chatType', new ParseEnumPipe(ChatType)) chatType: ChatType,
    @Body() body: CreateChatMessageDto,
  ) {
    return this.chatService.create(chatType, body.text);
  }
}
