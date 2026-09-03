import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
export class CreateAssetDto {
  @IsString() roomId!: string;
  @IsString() name!: string;
  @IsIn(['空调','床','柜子','热水器','其他']) type!: '空调'|'床'|'柜子'|'热水器'|'其他';
  @IsOptional() @IsString() brand?: string | null;
  @IsOptional() @IsString() model?: string | null;
  @IsOptional() @IsString() serialNo?: string | null;
  @IsOptional() @IsDateString() purchaseDate?: string | null;
  @IsOptional() @IsIn(['正常','损坏','已报废']) status?: '正常'|'损坏'|'已报废';
  @IsOptional() @IsString() damageNote?: string | null;
}
