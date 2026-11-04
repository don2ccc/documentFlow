import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export const ATTENDANCE_STATUSES = ['正常', 'OT加班', '迟到', '早退', '迟到/早退', '缺卡', '异常'] as const;

export class ListResultsQueryDto {
  @IsOptional() @IsString() uploadId?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() shiftCode?: string;
  @IsOptional() @IsIn(ATTENDANCE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

export class UploadAttendanceDto {
  @IsString() @Length(1, 64) shiftId!: string;
}
