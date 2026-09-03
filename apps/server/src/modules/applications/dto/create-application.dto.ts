import { IsNumberString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateApplicationDto {
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsUUID() workflowId?: string;
}
