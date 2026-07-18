import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucket: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const bucket = this.configService.get<string>('S3_BUCKET');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY не заданы — загрузка звонков будет недоступна, остальной API работает как обычно',
      );
      return;
    }

    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  private ensureConfigured(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new InternalServerErrorException(
        'Хранилище файлов не настроено на этом окружении (нет переменных S3_*)',
      );
    }
    return { client: this.client, bucket: this.bucket };
  }

  async onModuleInit() {
    if (!this.client || !this.bucket) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      this.logger.log(`Бакет "${this.bucket}" не найден, создаю`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.ensureConfigured();
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObjectStream(key: string): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
    const { client, bucket } = this.ensureConfigured();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return {
      stream: result.Body as Readable,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  }
}
