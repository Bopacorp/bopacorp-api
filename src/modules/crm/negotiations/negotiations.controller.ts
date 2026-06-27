import { UuidSchema } from '@bopacorp/shared/common';
import type {
  ChangeNegotiationStateRequest,
  CreateNegotiationRequest,
  ListNegotiationsQuery,
  UpdateNegotiationRequest,
} from '@bopacorp/shared/crm';
import { downloadNegotiationDocuments } from '@modules/documents/documents.service.js';
import { BadRequestError, UnauthorizedError } from '@shared/errors/http-error.js';
import { ValidationError } from '@shared/middleware/validate.js';
import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './negotiations.service.js';

export async function listNegotiations(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const query = req.query as unknown as ListNegotiationsQuery;
  const result = await service.listNegotiations(query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getNegotiationById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getNegotiationById(req.params.id);
  res.json({ success: true, data });
}

export async function createNegotiation(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createNegotiation(req.user.id, req.body as CreateNegotiationRequest);
  res.status(201).json({ success: true, data });
}

export async function updateNegotiation(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateNegotiation(req.params.id, req.body as UpdateNegotiationRequest);
  res.json({ success: true, data });
}

export async function removeNegotiation(req: Request<{ id: string }>, res: Response) {
  await service.removeNegotiation(req.params.id);
  res.json({ success: true, data: null });
}

export async function changeNegotiationState(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.changeNegotiationState(
    req.params.id,
    req.user.id,
    req.body as ChangeNegotiationStateRequest
  );
  res.json({ success: true, data });
}

export async function getNegotiationHistory(req: Request<{ id: string }>, res: Response) {
  const data = await service.getNegotiationHistory(req.params.id);
  res.json({ success: true, data });
}

const CloseWithDocumentsBodySchema = z.object({
  documentTypeIds: z.array(UuidSchema).min(1).max(10),
  notes: z.string().max(1000).optional(),
});

export async function closeWithDocuments(req: Request<{ id: string }>, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw new BadRequestError('At least one document file is required');
  }

  const rawIds: unknown = req.body.documentTypeIds;
  const documentTypeIds = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];

  const parsed = CloseWithDocumentsBodySchema.safeParse({
    documentTypeIds,
    notes: req.body.notes,
  });

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  }

  const data = await service.closeWithDocuments(
    req.params.id,
    req.user,
    files,
    parsed.data.documentTypeIds,
    parsed.data.notes
  );

  res.json({ success: true, data });
}

export async function downloadDocuments(req: Request<{ id: string }>, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');

  const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
  const { archive, negotiationId } = await downloadNegotiationDocuments(
    req.params.id,
    req.user,
    status
  );

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="documentos_${negotiationId}.zip"`);

  archive.pipe(res);
}
