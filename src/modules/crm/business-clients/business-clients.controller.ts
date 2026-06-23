import type {
  CreateBusinessClientRequest,
  ListBusinessClientsQuery,
  UpdateBusinessClientRequest,
} from '@bopacorp/shared/crm';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './business-clients.service.js';

export async function listBusinessClients(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const query = req.query as unknown as ListBusinessClientsQuery;
  const result = await service.listBusinessClients(query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getBusinessClientById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getBusinessClientById(req.params.id);
  res.json({ success: true, data });
}

export async function createBusinessClient(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createBusinessClient(
    req.body as CreateBusinessClientRequest,
    req.user.id
  );
  res.status(201).json({ success: true, data });
}

export async function updateBusinessClient(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateBusinessClient(
    req.params.id,
    req.body as UpdateBusinessClientRequest
  );
  res.json({ success: true, data });
}

export async function removeBusinessClient(req: Request<{ id: string }>, res: Response) {
  await service.removeBusinessClient(req.params.id);
  res.json({ success: true, data: null });
}
