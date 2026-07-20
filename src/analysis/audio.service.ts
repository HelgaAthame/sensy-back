import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs, readFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { WaveFile } from 'wavefile';
import { StorageService } from '../storage/storage.service';

export const WHISPER_SAMPLE_RATE = 16000;

@Injectable()
export class AudioService {
  constructor(private readonly storage: StorageService) {}

  async downloadToTemp(storageKey: string): Promise<string> {
    const { stream } = await this.storage.getObjectStream(storageKey);
    const tempPath = path.join(os.tmpdir(), `${randomUUID()}-source`);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    await fs.writeFile(tempPath, Buffer.concat(chunks));
    return tempPath;
  }

  splitChannel(sourcePath: string, channelIndex: number): Promise<string> {
    const outPath = path.join(os.tmpdir(), `${randomUUID()}-ch${channelIndex}.wav`);
    return new Promise((resolve, reject) => {
      ffmpeg(sourcePath)
        .audioFilters(`pan=mono|c0=c${channelIndex}`)
        .audioFrequency(WHISPER_SAMPLE_RATE)
        .toFormat('wav')
        .on('end', () => resolve(outPath))
        .on('error', (err) => reject(err))
        .save(outPath);
    });
  }

  readWavAsFloat32(filePath: string): Float32Array {
    const wav = new WaveFile(readFileSync(filePath));
    wav.toBitDepth('32f');
    wav.toSampleRate(WHISPER_SAMPLE_RATE);
    let samples = wav.getSamples();
    if (Array.isArray(samples)) {
      samples = samples[0];
    }
    return Float32Array.from(samples as unknown as number[]);
  }

  async cleanup(paths: string[]): Promise<void> {
    await Promise.all(paths.map((p) => fs.unlink(p).catch(() => undefined)));
  }
}
