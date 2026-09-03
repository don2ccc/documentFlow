import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() amount?: string;
  @IsOptional() @IsUUID('4', { message: '审批流程格式不正确' }) workflowId?: string;
}