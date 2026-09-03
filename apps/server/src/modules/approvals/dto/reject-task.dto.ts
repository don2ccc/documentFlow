import { IsNotEmpty, IsString } from 'class-validator';

export class RejectTaskDto {
  @IsString() @IsNotEmpty() comment!: string;
}