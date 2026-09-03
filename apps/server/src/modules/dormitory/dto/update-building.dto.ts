import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class UpdateBuildingDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsInt() @Min(1) totalFloors?: number;
  @IsOptional() @IsString() notes?: string | null;
}
