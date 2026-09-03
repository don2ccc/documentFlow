import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const IS_PUBLIC_KEY = 'isPublic';

export const RequirePermission = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);