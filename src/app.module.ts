import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { DictionariesModule } from './dictionaries/dictionaries.module';
import { OperatorsModule } from './operators/operators.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OperatorsModule,
    ProjectsModule,
    DictionariesModule,
    ChecklistsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
