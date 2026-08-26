import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() amount?: string;
}