import { env } from '@config/env.js';
import pino from 'pino';

const transport =
  env.LOG_PRETTY === 'true'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

const options = {
  level: env.LOG_LEVEL,
  base: {
    env: env.NODE_ENV,
    version: env.npm_package_version,
  },
};

export const logger = pino(transport ? { ...options, transport } : options);

export const createModuleLogger = (module: string) => logger.child({ module });
