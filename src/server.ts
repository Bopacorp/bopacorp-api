import { env } from '@config/env.js';
import { logger } from '@lib/logger.js';
import { authRoutes } from '@modules/auth/auth.routes.js';
import { catalogRoutes } from '@modules/catalog/catalog.routes.js';
import { catalogItemsRoutes } from '@modules/catalog-items/catalog-items.routes.js';
import { cmsRoutes } from '@modules/cms/cms.routes.js';
import { contactRequestsRoutes } from '@modules/contact-requests/contact-requests.routes.js';
import { crmRoutes } from '@modules/crm/crm.routes.js';
import { documentUploadsRoutes } from '@modules/document-uploads/document-uploads.routes.js';
import { documentsRoutes } from '@modules/documents/documents.routes.js';
import { employabilityRoutes } from '@modules/employability/employability.routes.js';
import { matricesRoutes } from '@modules/matrices/matrices.routes.js';
import { notificationsRoutes } from '@modules/notifications/notifications.routes.js';
import { orgRoutes } from '@modules/org/org.routes.js';
import { reportsRoutes } from '@modules/reports/reports.routes.js';
import { rolesRoutes } from '@modules/roles/roles.routes.js';
import { uploadsRoutes } from '@modules/uploads/uploads.routes.js';
import { usersRoutes } from '@modules/users/users.routes.js';
import { HttpError } from '@shared/errors/http-error.js';
import { authenticate } from '@shared/middleware/authenticate.js';
import { errorHandler } from '@shared/middleware/error-handler.js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

const app = express();
const PORT = env.PORT;

app.set('trust proxy', 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { method: req.method, url: req.url };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  req.log.info('Health check requested');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

app.use('/api/v1/catalog', authenticate, catalogRoutes);
app.use('/api/v1/catalog-items', authenticate, catalogItemsRoutes);
app.use('/api/v1/contact-requests', contactRequestsRoutes);
app.use('/api/v1/crm', authenticate, crmRoutes);
app.use('/api/v1/documents', authenticate, documentsRoutes);
app.use('/api/v1/document-uploads', authenticate, documentUploadsRoutes);
app.use('/api/v1/notifications', authenticate, notificationsRoutes);
app.use('/api/v1/reports', authenticate, reportsRoutes);
app.use('/api/v1/matrices', authenticate, matricesRoutes);
app.use('/api/v1/employability', employabilityRoutes);
app.use('/api/v1/cms', cmsRoutes);
app.use('/api/v1/users', authenticate, usersRoutes);
app.use('/api/v1/org', authenticate, orgRoutes);
app.use('/api/v1/roles', authenticate, rolesRoutes);
app.use('/api/v1/uploads', authenticate, uploadsRoutes);
app.use('/api/v1/auth', authRoutes);

app.use((req, _res) => {
  throw new HttpError(404, `${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND');
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});
