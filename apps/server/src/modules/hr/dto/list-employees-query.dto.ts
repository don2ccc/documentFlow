import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class ListEmployeesQueryDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() workGroup?: string;
  /**
 * active 的取值。
 *
 * 允许空串：前端的「全部」选项用空串表示「不筛选」，而 @IsOptional()
 * 只跳过 null / undefined，不跳过空串，早先会直接报
 * 「active must be one of the following values: true, false」。
 * service 层已改为只认 'true' / 'false'，空串按不筛选处理。
 */
@IsOptional() @IsIn(['true', 'false', '']) @Transform(({ value }) => String(value)) active?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) pageSize?: number;
}