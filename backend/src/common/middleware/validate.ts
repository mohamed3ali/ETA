import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.parse(req[source]);
    // attach parsed value back (Zod may transform/coerce)
    (req as any)[source] = parsed;
    next();
  };
