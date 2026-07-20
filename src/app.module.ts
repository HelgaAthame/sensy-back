import { Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AnalysisModule } from './analysis/analysis.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { DictionariesModule } from './dictionaries/dictionaries.module';
import { MediaFilesModule } from './media-files/media-files.module';
import { OperatorsModule } from './operators/operators.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Если REDIS_URL не задан или недоступен, BullMQ просто не сможет поставить задачу
    // в очередь (см. обработку в MediaFilesService) — не роняет остальной API, как раньше
    // делал жёсткий getOrThrow в StorageService.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.get<string>('REDIS_URL', 'redis://localhost:6379'));
        const logger = new Logger('Redis');
        // Без Redis (например, на Render, пока он там не настроен) ioredis по умолчанию пытается
        // переподключаться раз в пару секунд НАВСЕГДА и на каждый провал печатает полный стектрейс —
        // поток логов такой плотности сам по себе тормозит event loop и "вешает" не связанные
        // с очередью HTTP-запросы. Здесь: редкий бэкофф (до 30с) + свой обработчик 'error' вместо
        // дефолтного (который иначе печатает полный стек на каждую попытку), enableOfflineQueue:false,
        // чтобы команды сразу отклонялись, а не бесконечно ждали в оффлайн-очереди.
        const connection = new Redis({
          host: redisUrl.hostname,
          port: Number(redisUrl.port || 6379),
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
          connectTimeout: 3000,
          retryStrategy: (times: number) => Math.min(times * 1000, 30000),
        });
        let lastErrorLoggedAt = 0;
        connection.on('error', (error) => {
          const now = Date.now();
          if (now - lastErrorLoggedAt > 30000) {
            lastErrorLoggedAt = now;
            logger.warn(`Redis недоступен (${redisUrl.hostname}:${redisUrl.port || 6379}): ${error.message}`);
          }
        });
        return { connection };
      },
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    OperatorsModule,
    ProjectsModule,
    DictionariesModule,
    ChecklistsModule,
    AnalysisModule,
    MediaFilesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
