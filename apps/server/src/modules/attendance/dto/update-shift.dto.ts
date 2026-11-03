import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested
} from 'class-validator';
import { ShiftSegmentDto } from './create-shift.dto';

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: '班次编码只能包含字母、数字、下划线和中划线' })
  code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ShiftSegmentDto)
  segments?: ShiftSegmentDto[];

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(1440)
  standardMinutes?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
