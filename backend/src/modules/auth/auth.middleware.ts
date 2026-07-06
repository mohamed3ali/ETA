import { RequestHandler } from 'express';
import { verifyAccessToken } from './jwt.service';
import { HttpError } from '../../common/errors/HttpError';
import { UserRole } from '../users/user.entity';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(HttpError.unauthorized('Missing access token'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId,
    };
    return next();
  } catch {
    return next(HttpError.unauthorized('Invalid or expired access token'));
  }
};

export const requireRoles =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(HttpError.forbidden('Insufficient permissions'));
    }
    return next();
  };
