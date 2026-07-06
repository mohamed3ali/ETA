import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { logger } from './config/logger';
import { openapiSpec } from './config/swagger';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './common/middleware/errorHandler';

export const createApp = (): Express => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === `${env.API_PREFIX}/health` } }));

  // Global rate limit
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: env.NODE_ENV === 'production' ? 120 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(env.API_PREFIX, limiter);

  // Stricter limit on auth
  const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
  app.use(`${env.API_PREFIX}/auth`, authLimiter);

  // Swagger
  app.use(
    `${env.API_PREFIX}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, {
      customSiteTitle: 'ETA SaaS API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use(env.API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
