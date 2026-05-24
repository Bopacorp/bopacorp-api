import { env } from '@config/env.js';
import { logger } from '@lib/logger.js';
import { authRoutes } from '@modules/auth/auth.routes.js';
import { HttpError } from '@shared/errors/http-error.js';
import { errorHandler } from '@shared/middleware/error-handler.js';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

const app = express();
const PORT = env.PORT;

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => {
  req.log.info('Health check requested');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

app.use('/api/v1/auth', authRoutes);

app.use((req, _res) => {
  throw new HttpError(404, `${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND');
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});
