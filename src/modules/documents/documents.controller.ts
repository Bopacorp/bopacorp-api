import type {
  ChangeDocumentStateRequest,
  CreateDocumentTypeRequest,
  CreateNegotiationDocumentRequest,
  ListDocumentStateHistoryQuery,
  ListDocumentTypesQuery,
  ListNegotiationDocumentsQuery,
  UpdateDocumentTypeRequest,
  UpdateNegotiationDocumentRequest,
} from '@bopacorp/shared/documents';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './documents.service.js';

// ── Document Types ──

export async function listDocumentTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListDocumentTypesQuery;
  const result = await service.listDocumentTypes(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getDocumentTypeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getDocumentTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function createDocumentType(req: Request, res: Response) {
  const data = await service.createDocumentType(req.body as CreateDocumentTypeRequest);
  res.status(201).json({ success: true, data });
}

export async function updateDocumentType(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateDocumentType(
    req.params.id,
    req.body as UpdateDocumentTypeRequest
  );
  res.json({ success: true, data });
}

export async function removeDocumentType(req: Request<{ id: string }>, res: Response) {
  await service.removeDocumentType(req.params.id);
  res.json({ success: true, data: null });
}

// ── Negotiation Documents ──

export async function listDocuments(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const query = req.query as unknown as ListNegotiationDocumentsQuery;
  const result = await service.listDocuments(query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getDocumentById(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.getDocumentById(req.params.id, req.user);
  res.json({ success: true, data });
}

export async function createDocument(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createDocument(
    req.user.id,
    req.body as CreateNegotiationDocumentRequest
  );
  res.status(201).json({ success: true, data });
}

export async function updateDocument(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateDocument(
    req.params.id,
    req.body as UpdateNegotiationDocumentRequest
  );
  res.json({ success: true, data });
}

export async function removeDocument(req: Request<{ id: string }>, res: Response) {
  await service.removeDocument(req.params.id);
  res.json({ success: true, data: null });
}

export async function changeDocumentState(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.changeDocumentState(
    req.params.id,
    req.user.id,
    req.body as ChangeDocumentStateRequest
  );
  res.json({ success: true, data });
}

// ── Pending Summary ──

export async function getPendingSummary(_req: Request, res: Response) {
  const data = await service.getPendingSummary();
  res.json({ success: true, data });
}

// ── Document State History ──

export async function listDocumentHistory(req: Request<{ id: string }>, res: Response) {
  const query = req.query as unknown as ListDocumentStateHistoryQuery;
  const result = await service.listDocumentHistory({ ...query, documentId: req.params.id });
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function downloadDocument(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const { buffer, filename, mimeType } = await service.downloadDocument(req.params.id, req.user);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', buffer.length.toString());
  res.send(buffer);
}
