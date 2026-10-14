import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumberString, IsOptional, IsString, Length, Matches, Max, Min
} from 'class-validator';

/** 旧系统 HR_Leave 的状态码：1=请假中 2=黑名单 */
export const ENTRY_TYPES = ['001', '002', '999'] as const;

export class CreateEmployeeDto {
  @IsString()
  @Length(8, 8, { message: '员工工号必须是 8 位' })
  @Matches(/^[0-9A-Za-z]+$/, { message: '员工工号只能包含字母和数字' })
  employeeNo!: string;

  @IsString() @Length(1, 50) name!: string;

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