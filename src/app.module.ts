import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    PrismaModule,
    StorageModule,
    AuthModule,
    OperatorsModule,
    ProjectsModule,
    DictionariesModule,
    ChecklistsModule,
    MediaFilesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
