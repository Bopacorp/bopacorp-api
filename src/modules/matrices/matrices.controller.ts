import type {
  ChangeMatrixStateRequest,
  CreateMatrixAttachmentRequest,
  CreateMatrixLineItemRequest,
  CreateOfferMatrixRequest,
  ListMatrixAttachmentsQuery,
  ListMatrixLineItemsQuery,
  ListMatrixStateHistoryQuery,
  ListOfferMatricesQuery,
  UpdateMatrixLineItemRequest,
  UpdateOfferMatrixRequest,
} from '@bopacorp/shared/matrices';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './matrices.service.js';

// ── Offer Matrices ──

export async function listOfferMatrices(req: Request, res: Response) {
  const query = req.query as unknown as ListOfferMatricesQuery;
  const result = await service.listOfferMatrices(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getOfferMatrixById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getOfferMatrixById(req.params.id);
  res.json({ success: true, data });
}

export async function createOfferMatrix(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const data = await service.createOfferMatrix(req.user.id, req.body as CreateOfferMatrixRequest);
  res.status(201).json({ success: true, data });
}

export async function updateOfferMatrix(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateOfferMatrix(req.params.id, req.body as UpdateOfferMatrixRequest);
  res.json({ success: true, data });
}

export async function removeOfferMatrix(req: Request<{ id: string }>, res: Response) {
  await service.removeOfferMatrix(req.params.id);
  res.json({ success: true, data: null });
}

export async function changeMatrixState(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const data = await service.changeMatrixState(
    req.params.id,
    req.user.id,
    req.body as ChangeMatrixStateRequest
  );
  res.json({ success: true, data });
}

// ── Matrix Line Items ──

export async function listMatrixLineItems(req: Request<{ id: string }>, res: Response) {
  const query = req.query as unknown as ListMatrixLineItemsQuery;
  const result = await service.listMatrixLineItems({ ...query, matrixId: req.params.id });
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function createMatrixLineItem(req: Request<{ id: string }>, res: Response) {
  const data = await service.createMatrixLineItem({
    ...req.body,
    matrixId: req.params.id,
  } as CreateMatrixLineItemRequest);
  res.status(201).json({ success: true, data });
}

export async function updateMatrixLineItem(
  req: Request<{ id: string; lineItemId: string }>,
  res: Response
) {
  const data = await service.updateMatrixLineItem(
    req.params.lineItemId,
    req.body as UpdateMatrixLineItemRequest
  );
  res.json({ success: true, data });
}

export async function removeMatrixLineItem(
  req: Request<{ id: string; lineItemId: string }>,
  res: Response
) {
  await service.removeMatrixLineItem(req.params.lineItemId);
  res.json({ success: true, data: null });
}

// ── Matrix Attachments ──

export async function listMatrixAttachments(req: Request<{ id: string }>, res: Response) {
  const query = req.query as unknown as ListMatrixAttachmentsQuery;
  const result = await service.listMatrixAttachments({ ...query, matrixId: req.params.id });
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function createMatrixAttachment(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const data = await service.createMatrixAttachment(req.user.id, {
    ...req.body,
    matrixId: req.params.id,
  } as CreateMatrixAttachmentRequest);
  res.status(201).json({ success: true, data });
}

export async function removeMatrixAttachment(
  req: Request<{ id: string; attachmentId: string }>,
  res: Response
) {
  await service.removeMatrixAttachment(req.params.attachmentId);
  res.json({ success: true, data: null });
}

// ── Matrix State History ──

export async function listMatrixStateHistory(req: Request<{ id: string }>, res: Response) {
  const query = req.query as unknown as ListMatrixStateHistoryQuery;
  const result = await service.listMatrixStateHistory({ ...query, matrixId: req.params.id });
  res.json({ success: true, data: result.data, meta: result.meta });
}
