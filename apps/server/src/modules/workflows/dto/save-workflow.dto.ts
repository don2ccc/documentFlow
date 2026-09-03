import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { NodeType } from '@document-flow/shared';

export class WorkflowNodeDto {
  @IsString() @IsNotEmpty() id!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsIn(Object.values(NodeType)) type!: string;
  @IsOptional() @IsString() approverRule?: string;
  @IsOptional() @IsString() approverValue?: string;
  @IsOptional() @IsString() approvalMethod?: string;
  @IsOptional() @Type(() => Number) @IsInt() timeoutDays?: number;
  @IsOptional() @IsString() timeoutAction?: string;
  @IsOptional() config?: Record<string, unknown>;
}

export class WorkflowEdgeDto {
  @IsString() @IsNotEmpty() id!: string;
  @IsString() @IsNotEmpty() fromNodeId!: string;
  @IsString() @IsNotEmpty() toNodeId!: string;
  @IsOptional() conditionExpr?: { field: string; op: string; value: number | string } | null;
}

export class SaveWorkflowDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => WorkflowNodeDto) nodes!: WorkflowNodeDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkflowEdgeDto) edges?: WorkflowEdgeDto[];
}