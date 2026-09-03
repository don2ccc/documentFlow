import { IsDateString, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateMeterReadingDto {
  @IsString() roomId!: string;
  @IsString() @Length(7, 7) period!: string; // YYYY-MM
  @IsNumber() @Min(0) electricReading!: number;
  @IsNumber() @Min(0) waterReading!: number;
  @IsOptional() @IsNumber() @Min(0) publicElectricUsage?: number;
  @IsOptional() @IsNumber() @Min(0) publicWaterUsage?: number;
  @IsDateString() readingDate!: string;
  @IsOptional() @IsString() recordedBy?: string;
  @IsOptional() @IsString() notes?: string;
}
