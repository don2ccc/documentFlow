import { IsIn, IsOptional, IsString } from 'class-validator';
export class UpdateBedDto {
  @IsOptional() @IsString() bedNo?: string;
  @IsOptional() @IsIn(['空闲','已住','维修中','禁用']) status?: '空闲'|'已住'|'维修中'|'禁用';
  @IsOptional() @IsString() notes?: string | null;
}
