import { IsArray, IsISO8601, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DeviceSyncItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  idempotencyKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  patient!: string;

  @IsOptional()
  @IsISO8601()
  capturedAt?: string;

  @IsString()
  @IsNotEmpty()
  raw_b64!: string;

  @IsOptional()
  @IsObject()
  header?: Record<string, unknown>;
}

export class DeviceSyncDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  deviceSerial!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryPct?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceSyncItemDto)
  items!: DeviceSyncItemDto[];
}

export class DeviceCalibrationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calibrationGain!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason!: string;
}
