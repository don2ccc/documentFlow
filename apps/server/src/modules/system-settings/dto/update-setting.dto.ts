import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class TestEmailDto {
  @IsString()
  @IsNotEmpty()
  to!: string;
}

export class RenewSslDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  days?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsString()
  organizationalUnit?: string;

  @IsOptional()
  @IsString()
  commonName?: string;
}
