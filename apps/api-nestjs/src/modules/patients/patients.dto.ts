import { FistulaType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9-]+$/)
  idPseudo!: string;

  @IsEnum(FistulaType)
  fistulaType!: FistulaType;

  @IsIn(['LEFT', 'RIGHT'])
  armSide!: string;
}

export class RebaselineDto {
  @IsString()
  @Length(1, 500)
  reason!: string;
}

export class CreateNoteDto {
  @IsString()
  @Length(1, 2000)
  text!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  measurementId?: string;
}

export class CreateFollowUpIntentDto {
  @IsString()
  @Length(1, 64)
  measurementId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
