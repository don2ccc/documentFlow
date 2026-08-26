import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitDocumentDto {
  @IsUUID() @IsNotEmpty() workflowId!: string;
  @IsOptional() @IsObject() chosenApproverIds?: Record<string, string>;
}