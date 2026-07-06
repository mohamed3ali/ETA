import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { UserRole } from '../users/user.entity';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string;
}

export interface JwtRefreshPayload {
  sub: string;
  companyId: string;
  type: 'refresh';
}

export const signAccessToken = (payload: JwtAccessPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  } as SignOptions);

export const signRefreshToken = (payload: Omit<JwtRefreshPayload, 'type'>): string =>
  jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  } as SignOptions);

export const verifyAccessToken = (token: string): JwtAccessPayload =>
  jwt.verify(token, env.JWT_SECRET) as JwtAccessPayload;

export const verifyRefreshToken = (token: string): JwtRefreshPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
