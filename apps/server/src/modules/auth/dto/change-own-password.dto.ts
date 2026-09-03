import { IsString, MinLength } from 'class-validator';

export class ChangeOwnPasswordDto {
  @IsString() @MinLength(8) newPassword!: string;
}
