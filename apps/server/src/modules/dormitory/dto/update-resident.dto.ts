import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class UpdateResidentDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() department?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsDateString() hireDate?: string | null;
  @IsOptional() @IsString() bedId?: string | null;
  @IsOptional() @IsDateString() checkInDate?: string;
  @IsOptional() @IsDateString() checkOutDate?: string | null;
  @IsOptional() @IsIn(['在住','已退宿']) status?: '在住'|'已退宿';
  @IsOptional() @IsString() checkOutItemsCheck?: string | null;
  @IsOptional() @IsNumber() @Min(0) checkOutSettlement?: number;
  @IsOptional() @IsString() notes?: string | null;
}
