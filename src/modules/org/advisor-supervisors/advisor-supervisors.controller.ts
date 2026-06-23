import type {
  AssignAdvisorSupervisorsRequest,
  ListAdvisorSupervisorsQuery,
} from '@bopacorp/shared/core';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './advisor-supervisors.service.js';

function getClientInfo(req: Request) {
  const info: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) info.ipAddress = req.ip;
  if (req.headers['user-agent']) info.userAgent = req.headers['user-agent'];
  return info;
}

export async function listSupervisors(req: Request<{ userId: string }>, res: Response) {
  const query = req.query as unknown as ListAdvisorSupervisorsQuery;
  const result = await service.listSupervisors(req.params.userId, query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function listAdvisors(req: Request<{ userId: string }>, res: Response) {
  const query = req.query as unknown as ListAdvisorSupervisorsQuery;
  const result = await service.listAdvisors(req.params.userId, query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function assignSupervisors(req: Request<{ userId: string }>, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const data = await service.assignSupervisors(
    req.user.id,
    req.params.userId,
    req.body as AssignAdvisorSupervisorsRequest,
    getClientInfo(req)
  );
  res.json({ success: true, data: data.data, meta: data.meta });
}
