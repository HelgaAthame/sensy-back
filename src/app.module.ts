import { Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { AnalysisModule } from './analysis/analysis.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DictionariesModule } from './dictionaries/dictionaries.module';
import { GptModule } from './gpt/gpt.module';
import { MediaFilesModule } from './media-files/media-files.module';
import { OperatorsModule } from './operators/operators.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { buildProducerConnection } from './redis-connection';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Если REDIS_URL не задан или недоступен, BullMQ просто не сможет поставить задачу
    // в очередь (см. обработку в MediaFilesService) — не роняет остальной API, как раньше
    // делал жёсткий getOrThrow в StorageService.
    //
    // Это соединение — только для продюсера (postановка задачи в очередь из HTTP-запроса),
    // поэтому оно настроено на быстрый отказ (enableOfflineQueue:false). У воркеров
    // (@Processor в analysis/gpt-analysis) — своё, более терпеливое соединение
    // (buildWorkerConnection в redis-connection.ts), т.к. их долгоживущее blocking-чтение
    // очереди не должно тут же падать при малейшей сетевой заминке.
    BullModule.forRoot({
      connection: (() => {
        const connection = new Redis(buildProducerConnection());
        const logger = new Logger('Redis');
        let lastErrorLoggedAt = 0;
        connection.on('error', (error) => {
          const now = Date.now();
          if (now - lastErrorLoggedAt > 30000) {
            lastErrorLoggedAt = now;
            logger.warn(`Redis (продюсер) недоступен: ${error.message}`);
          }
        });
        return connection;
      })(),
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    OperatorsModule,
    ProjectsModule,
    DictionariesModule,
    ChecklistsModule,
    AnalysisModule,
    GptModule,
    MediaFilesModule,
    DashboardModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
