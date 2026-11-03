import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested
} from 'class-validator';

export class ShiftSegmentDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: '开始时间格式必须为 HH:mm' })
  start!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: '结束时间格式必须为 HH:mm' })
  end!: string;
}

export class CreateShiftDto {
  @IsString()
  @Length(1, 20, { message: '班次编码长度 1-20' })
  @Matches(/^[A-Za-z0-9_-]+$/, { message: '班次编码只能包含字母、数字、下划线和中划线' })
  code!: string;

  @IsString()
  @Length(1, 50, { message: '班次名称长度 1-50' })
  name!: string;

  @IsArray()
  @ArrayMinSize(1, { message: '至少需要一个班次时间段' })
  @ArrayMaxSize(8, { message: '最多 8 个班次时间段' })
  @ValidateNested({ each: true })
  @Type(() => ShiftSegmentDto)
  segments!: ShiftSegmentDto[];

  @IsInt()
  @Min(60, { message: '标准工时至少 60 分钟' })
  @Max(1440, { message: '标准工时不能超过 1440 分钟' })
  standardMinutes!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
