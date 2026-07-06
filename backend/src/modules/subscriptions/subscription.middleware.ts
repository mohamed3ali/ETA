import { RequestHandler } from 'express';

import { HttpError } from '../../common/errors/HttpError';
import { quotaService } from './quota.service';

/**
 * Gate that blocks billable write operations when the tenant has no active
 * subscription (or it has expired). Read-only endpoints intentionally stay
 * open so users can still review historical data after expiry.
 */
export const requireActiveSubscription: RequestHandler = async (req, _res, next) => {
  if (!req.user) return next(HttpError.unauthorized());
  try {
    await quotaService.assertActiveSubscription(req.user.companyId);
    return next();
  } catch (err) {
    return next(err);
  }
};
