import { IsDateString, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class GenerateBillsDto {
  @IsString() @Length(7, 7) period!: string; // YYYY-MM
  @IsOptional() @IsNumber() @Min(0) electricRate?: number; // 元/度
  @IsOptional() @IsNumber() @Min(0) waterRate?: number;   // 元/吨
  @IsOptional() @IsNumber() @Min(0) roomRate?: number;    // 元/人/月
  @IsDateString() dueDate!: string;
  @IsOptional() @IsString() notes?: string;
}
