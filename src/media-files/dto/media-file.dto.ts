import { ApiProperty } from '@nestjs/swagger';

class AdditionalMetadataDto {
  @ApiProperty({ nullable: true })
  outerId!: string | null;

  @ApiProperty({ nullable: true })
  clientId!: string | null;

  @ApiProperty({ nullable: true })
  clientNumber!: string | null;

  @ApiProperty({ nullable: true })
  direction!: string | null;
}

class SummaryAnalyserResultDto {
  @ApiProperty({ nullable: true }) simultaneousSpeechCount!: number | null;
  @ApiProperty() simultaneousSilenceCount!: number;
  @ApiProperty({ nullable: true }) maxSimultaneousSpeechDuration!: number | null;
  @ApiProperty() maxSimultaneousSilenceDuration!: number;
  @ApiProperty({ nullable: true }) averageSimultaneousSpeechDuration!: number | null;
  @ApiProperty() averageSimultaneousSilenceDuration!: number;
  @ApiProperty({ type: Object }) keywordsSearchCounter!: Record<string, number>;
  @ApiProperty() totalSpeechOverall!: number;
  @ApiProperty() totalNonSpeechOverall!: number;
  @ApiProperty() negativeLevelOverall!: number;
  @ApiProperty({ nullable: true }) totalSpeechDurationOperator!: number | null;
  @ApiProperty({ nullable: true }) totalNonSpeechDurationOperator!: number | null;
  @ApiProperty({ nullable: true }) negativeSpeechWeightedDurationOperator!: number | null;
  @ApiProperty({ nullable: true }) negativeLevelOperator!: number | null;
  @ApiProperty({ nullable: true }) totalSpeechDurationClient!: number | null;
  @ApiProperty({ nullable: true }) totalNonSpeechDurationClient!: number | null;
  @ApiProperty({ nullable: true }) negativeSpeechWeightedDurationClient!: number | null;
  @ApiProperty({ nullable: true }) negativeLevelClient!: number | null;
}

export class MediaFileDto {
  @ApiProperty({ nullable: true })
  projectName!: string | null;

  @ApiProperty({ nullable: true })
  gptChecklist!: Record<string, unknown> | null;

  @ApiProperty()
  gptSummary!: string;

  @ApiProperty()
  id!: number;

  @ApiProperty({ nullable: true })
  fileName!: string | null;

  @ApiProperty()
  totalCount!: number;

  @ApiProperty()
  numChannels!: number;

  @ApiProperty()
  sampleRate!: number;

  @ApiProperty()
  duration!: number;

  @ApiProperty({ nullable: true })
  operatorId!: number | null;

  @ApiProperty({ nullable: true })
  operatorName!: string | null;

  @ApiProperty({ nullable: true })
  operatorChannel!: string | null;

  @ApiProperty()
  lastAccessUtc!: string;

  @ApiProperty()
  createDate!: string;

  @ApiProperty()
  isFailed!: boolean;

  @ApiProperty({ type: AdditionalMetadataDto })
  additionalMetadata!: AdditionalMetadataDto;

  @ApiProperty({ type: SummaryAnalyserResultDto })
  summaryAnalyserResult!: SummaryAnalyserResultDto;

  @ApiProperty()
  filteredKeywordsCount!: number;
}

export class MediaFileListResponseDto {
  @ApiProperty()
  totalCount!: number;

  @ApiProperty({ type: [MediaFileDto] })
  mediaFile!: MediaFileDto[];
}
