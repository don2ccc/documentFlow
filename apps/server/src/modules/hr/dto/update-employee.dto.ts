import {
  IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumberString, IsOptional, IsString, Length, Matches, Max, Min
} from 'class-validator';
import { ENTRY_TYPES } from './create-employee.dto';

/**
 * 更新员工档案用。
 *
 * 不能复用 CreateEmployeeDto：那里面 employeeNo / name 是必填，
 * 而更新时前端只提交发生变化的字段（例如只改职务），
 * 复用会报 400 "employeeNo must be a string"。
 *
 * 这里按项目既有惯例（参见 users/dto/update-user.dto.ts）逐字段声明，
 * 全部 @IsOptional()，但保留格式类校验（工号 8 位、身份证 18 位、
 * 入职方式枚举等），未提交的字段由 service 层保持原值。
 *
 * 注意：不能简单地把字段声明成 `name?: string` 而不挂装饰器——
 * app.module 的 ValidationPipe 开了 whitelist: true，
 * 没有校验元数据的属性会被直接剥掉。
 */
export class UpdateEmployeeDto {
  @IsOptional() @IsString() @Length(8, 8, { message: '员工工号必须是 8 位' })
  @Matches(/^[0-9A-Za-z]+$/, { message: '员工工号只能包含字母和数字' })
  employeeNo?: string;

  @IsOptional() @IsString() @Length(1, 50) name?: string;
  @IsOptional() @IsString() namePinyin?: string;
  @IsOptional() @IsString() namePinyinRest?: string;
  @IsOptional() @IsIn(['男', '女']) gender?: string;
  @IsOptional() @IsString() nation?: string;
  @IsOptional() @IsDateString({}, { message: '出生日期格式不正确' }) birthDate?: string;
  @IsOptional() @IsInt() @Min(0) @Max(120) age?: number;

  @IsOptional() @IsString() @Length(18, 18, { message: '身份证号必须是 18 位' }) idCardNo?: string;
  @IsOptional() @IsString() idCardAddress?: string;
  @IsOptional() @IsString() address?: string;

  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail({}, { message: '请输入合法邮箱' }) email?: string;
  @IsOptional() @IsString() bankNo?: string;
  @IsOptional() @IsString() cardNo?: string;

  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() workGroup?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() workLocation?: string;
  @IsOptional() @IsString() supervisor?: string;

  @IsOptional() @IsDateString() joinDate?: string;
  @IsOptional() @IsDateString() leaveDate?: string;
  @IsOptional() @IsIn(ENTRY_TYPES, { message: '入职方式只能是 001 / 002 / 999' }) entryType?: string;

  @IsOptional() @IsString() education?: string;
  @IsOptional() @IsString() major?: string;
  @IsOptional() @IsString() school?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsNumberString({}, { message: '薪资格式不正确' }) salary?: string;

  @IsOptional() @IsString() returnedStatus?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}