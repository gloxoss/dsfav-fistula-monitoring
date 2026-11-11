import { PerceivedThrill } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BENCH_CLAMP_STENOSIS_VALUES } from './bench.constants.js';

export class CreateBenchSessionDto {
  @IsNumber()
  @Min(1)
  @Max(2000)
  pumpFlowMlMin!: number;

  @IsIn([...BENCH_CLAMP_STENOSIS_VALUES])
  clampStenosisPct!: number;
}

export class SubmitBenchPalpationDto {
  @IsEnum(PerceivedThrill)
  perceivedThrill!: PerceivedThrill;

  @IsInt()
  @Min(1)
  @Max(5)
  perceivedIntensity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internNotes?: string | null;
}

export class CompleteBenchCaptureDto {
  @IsUUID()
  measurementId!: string;
}

export class ImportBenchCsvDto {
  @IsString()
  @MaxLength(1_000_000)
  csvContent!: string;
}
