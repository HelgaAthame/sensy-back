import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

@Injectable()
export class GroqClient {
  private readonly logger = new Logger(GroqClient.name);

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GROQ_API_KEY не задан — GPT-функции недоступны');
    }
    return apiKey;
  }

  /** JSON-режим: модель обязана вернуть валидный JSON-объект строкой. */
  async completeJson(messages: ChatMessage[]): Promise<string> {
    return this.complete(messages, { response_format: { type: 'json_object' } });
  }

  async completeText(messages: ChatMessage[]): Promise<string> {
    return this.complete(messages);
  }

  private async complete(messages: ChatMessage[], extra: Record<string, unknown> = {}): Promise<string> {
    const apiKey = this.getApiKey();
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        ...extra,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Groq API вернул ${response.status}: ${body}`);
      throw new Error(`Groq API вернул ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Groq API вернул пустой ответ');
    }
    return content;
  }
}
