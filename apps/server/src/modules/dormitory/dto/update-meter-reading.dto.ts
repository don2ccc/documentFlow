import { IsDateString, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateMeterReadingDto {
  @IsOptional() @IsNumber() @Min(0) electricReading?: number;
  @IsOptional() @IsNumber() @Min(0) waterReading?: number;
  @IsOptional() @IsNumber() @Min(0) publicElectricUsage?: number;
  @IsOptional() @IsNumber() @Min(0) publicWaterUsage?: number;
  @IsOptional() @IsDateString() readingDate?: string;
  @IsOptional() @IsString() recordedBy?: string;
  @IsOptional() @IsString() notes?: string;
}
