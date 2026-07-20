import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            maxRetriesPerRequest: null,
          },
        };
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
