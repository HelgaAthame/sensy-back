import { Injectable } from '@nestjs/common';
import { SttChunkResult } from './stt.service';

export interface KeywordDictionary {
  id: number;
  name: string | null;
  type: 'All' | 'OnlyOperator' | 'OnlyClient' | 'Hotwords';
  phrases: string[];
}

export interface KeywordMatch {
  category: number;
  categoryName: string | null;
  phrase: string | null;
  startChar: number;
  endChar: number;
  startTime: number;
  endTime: number;
  channel: number;
}

/** По телефонийной конвенции: канал 0 — оператор, канал 1 — клиент. */
function dictionaryAppliesToChannel(type: KeywordDictionary['type'], channel: number): boolean {
  if (type === 'OnlyOperator') return channel === 0;
  if (type === 'OnlyClient') return channel === 1;
  return true;
}

@Injectable()
export class KeywordSearchService {
  search(
    channel: number,
    text: string,
    chunks: SttChunkResult[],
    dictionaries: KeywordDictionary[],
  ): KeywordMatch[] {
    if (!text) return [];
    const matches: KeywordMatch[] = [];
    const lowerText = text.toLowerCase();

    for (const dictionary of dictionaries) {
      if (!dictionaryAppliesToChannel(dictionary.type, channel)) continue;

      for (const phrase of dictionary.phrases) {
        const lowerPhrase = phrase.trim().toLowerCase();
        if (!lowerPhrase) continue;

        let fromIndex = 0;
        while (true) {
          const startChar = lowerText.indexOf(lowerPhrase, fromIndex);
          if (startChar === -1) break;
          const endChar = startChar + lowerPhrase.length;

          const chunk =
            chunks.find((c) => startChar >= c.startChar && startChar < c.endChar) ??
            chunks.find((c) => endChar > c.startChar && endChar <= c.endChar);

          matches.push({
            category: dictionary.id,
            categoryName: dictionary.name,
            phrase,
            startChar,
            endChar,
            startTime: chunk?.startTime ?? 0,
            endTime: chunk?.endTime ?? chunk?.startTime ?? 0,
            channel,
          });

          fromIndex = endChar;
        }
      }
    }

    return matches;
  }
}
