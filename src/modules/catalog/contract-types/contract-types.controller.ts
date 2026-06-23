import type {
  CreateContractTypeRequest,
  ListContractTypesQuery,
  UpdateContractTypeRequest,
} from '@bopacorp/shared/catalog';
import type { Request, Response } from 'express';
import * as service from './contract-types.service.js';

export async function listContractTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListContractTypesQuery;
  const data = await service.listContractTypes(query);
  res.json({ success: true, data });
}

export async function getContractTypeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getContractTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function createContractType(req: Request, res: Response) {
  const data = await service.createContractType(req.body as CreateContractTypeRequest);
  res.status(201).json({ success: true, data });
}

export async function updateContractType(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateContractType(
    req.params.id,
    req.body as UpdateContractTypeRequest
  );
  res.json({ success: true, data });
}

export async function disableContractType(req: Request<{ id: string }>, res: Response) {
  await service.disableContractType(req.params.id);
  res.json({ success: true, data: null });
}
