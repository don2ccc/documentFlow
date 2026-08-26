import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class TransferTaskDto {
  @IsUUID() @IsNotEmpty() toUserId!: string;
  @IsOptional() @IsString() comment?: string;
}