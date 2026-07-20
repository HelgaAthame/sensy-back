import { ApiProperty } from '@nestjs/swagger';

export class PlotDataItemDto {
  @ApiProperty()
  dateTime!: string;

  @ApiProperty()
  keywordsExceedCount!: number;

  @ApiProperty()
  maxSilenceDurationExceedCount!: number;

  @ApiProperty()
  negativeLevelExceedCount!: number;

  @ApiProperty()
  simultaneousSpeechExceedCount!: number;
}

export class SummaryDataDto {
  @ApiProperty()
  recordsCount!: number;

  @ApiProperty()
  averageDuration!: number;

  @ApiProperty()
  averageNegativeLevelOverall!: number;

  @ApiProperty()
  averageKeywordsCount!: number;

  @ApiProperty()
  averageMaxSimultaneousSilenceDuration!: number;

  @ApiProperty()
  averageSimultaneousSpeechCount!: number;
}

export class OperatorRatingDataItemDto extends SummaryDataDto {
  @ApiProperty({ nullable: true })
  operatorName!: string | null;
}

export class DashboardResponseDto {
  @ApiProperty({ type: Object, description: 'Частота фраз из словарей: { [phrase]: count }' })
  keywordsFrequencyData!: Record<string, number>;

  @ApiProperty()
  messageText!: string;

  @ApiProperty({ type: [PlotDataItemDto] })
  plotData!: PlotDataItemDto[];

  @ApiProperty({ type: Object, description: 'Гистограмма негатива: { "0.0"..."0.9": count }' })
  negativeHistogramData!: Record<string, number>;

  @ApiProperty({ type: SummaryDataDto })
  summaryData!: SummaryDataDto;

  @ApiProperty({ type: [OperatorRatingDataItemDto] })
  operatorRatingData!: OperatorRatingDataItemDto[];
}
