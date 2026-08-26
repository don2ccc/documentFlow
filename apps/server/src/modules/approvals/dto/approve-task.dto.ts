import { IsOptional, IsString } from 'class-validator';

export class ApproveTaskDto {
  @IsOptional() @IsString() comment?: string;
}