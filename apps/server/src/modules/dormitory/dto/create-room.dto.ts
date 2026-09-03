import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CreateRoomDto {
  @IsString() buildingId!: string;
  @IsInt() @Min(0) floor!: number;
  @IsString() @MaxLength(40) roomNo!: string;
  @IsIn(['四人间','双人间','单人间']) type!: '四人间'|'双人间'|'单人间';
  @IsOptional() @IsInt() @Min(1) totalBeds?: number;
  @IsOptional() @IsString() notes?: string | null;
}
