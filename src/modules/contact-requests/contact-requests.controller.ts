import type { CreateContactRequest, ListContactRequestsQuery } from '@bopacorp/shared/catalog';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './contact-requests.service.js';

export async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListContactRequestsQuery;
  const result = await service.listContactRequests(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getContactRequestById(req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const data = await service.createContactRequest(req.body as CreateContactRequest);
  res.status(201).json({ success: true, data });
}

export async function attend(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.attendContactRequest(req.params.id, req.user.id);
  res.json({ success: true, data });
}
