import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MeasurementSource } from '@prisma/client';

export class CreateMeasurementDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idPseudo?: string | null;

  @IsOptional()
  @IsEnum(MeasurementSource)
  source?: MeasurementSource;
}

export class AbandonMeasurementDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}
