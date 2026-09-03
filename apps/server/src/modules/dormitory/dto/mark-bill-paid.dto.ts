import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class MarkBillPaidDto {
  @IsNumber() @Min(0) paidAmount!: number;
  @IsOptional() @IsString() notes?: string;
}
