import { IsEnum } from 'class-validator';
import { UserStatus } from '@document-flow/shared';

export class UpdateStatusDto {
  @IsEnum(UserStatus) status!: UserStatus;
}