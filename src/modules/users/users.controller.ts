import type {
  AssignUserRolesRequest,
  CreateUserRequest,
  ListUsersQuery,
  UpdateUserRequest,
} from '@bopacorp/shared/auth';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import { getClientInfo } from '@shared/utils/request.js';
import type { Request, Response } from 'express';
import * as service from './users.service.js';

export async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListUsersQuery;
  const result = await service.listUsers(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getUserById(req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createUser(
    req.user.id,
    req.body as CreateUserRequest,
    getClientInfo(req)
  );
  res.status(201).json({ success: true, data });
}

export async function update(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.updateUser(
    req.user.id,
    req.params.id,
    req.body as UpdateUserRequest,
    getClientInfo(req)
  );
  res.json({ success: true, data });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  await service.deleteUser(req.user.id, req.params.id, getClientInfo(req));
  res.json({ success: true, data: { message: 'User deleted successfully' } });
}

export async function assignRoles(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const body = req.body as AssignUserRolesRequest;
  const data = await service.assignUserRoles(
    req.user.id,
    req.params.id,
    body.roleIds,
    getClientInfo(req)
  );
  res.json({ success: true, data });
}
