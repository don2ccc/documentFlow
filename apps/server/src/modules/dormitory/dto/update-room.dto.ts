import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class UpdateRoomDto {
  @IsOptional() @IsString() buildingId?: string;
  @IsOptional() @IsInt() @Min(0) floor?: number;
  @IsOptional() @IsString() @MaxLength(40) roomNo?: string;
  @IsOptional() @IsIn(['四人间','双人间','单人间']) type?: '四人间'|'双人间'|'单人间';
  @IsOptional() @IsInt() @Min(1) totalBeds?: number;
  @IsOptional() @IsString() notes?: string | null;
}
