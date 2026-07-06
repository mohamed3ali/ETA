import IORedis, { RedisOptions } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: true,
};

let _redis: IORedis | null = null;

export const getRedis = (): IORedis => {
  if (!_redis) {
    _redis = new IORedis(redisOptions);
    _redis.on('connect', () => logger.info('Redis connected'));
    _redis.on('error', (err) => logger.error({ err }, 'Redis error'));
  }
  return _redis;
};
