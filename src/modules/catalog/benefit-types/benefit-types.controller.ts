import type {
  CreateBenefitTypeRequest,
  ListBenefitTypesQuery,
  UpdateBenefitTypeRequest,
} from '@bopacorp/shared/catalog';
import type { Request, Response } from 'express';
import * as service from './benefit-types.service.js';

export async function listBenefitTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListBenefitTypesQuery;
  const data = await service.listBenefitTypes(query);
  res.json({ success: true, data });
}

export async function getBenefitTypeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getBenefitTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function createBenefitType(req: Request, res: Response) {
  const data = await service.createBenefitType(req.body as CreateBenefitTypeRequest);
  res.status(201).json({ success: true, data });
}

export async function updateBenefitType(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateBenefitType(req.params.id, req.body as UpdateBenefitTypeRequest);
  res.json({ success: true, data });
}

export async function disableBenefitType(req: Request<{ id: string }>, res: Response) {
  await service.disableBenefitType(req.params.id);
  res.json({ success: true, data: null });
}
