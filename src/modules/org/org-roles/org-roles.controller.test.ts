import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListOrgRoles = vi.fn();
const mockGetOrgRoleById = vi.fn();
const mockCreateOrgRole = vi.fn();
const mockUpdateOrgRole = vi.fn();
const mockDisableOrgRole = vi.fn();

vi.mock('./org-roles.service.js', () => ({
  listOrgRoles: mockListOrgRoles,
  getOrgRoleById: mockGetOrgRoleById,
  createOrgRole: mockCreateOrgRole,
  updateOrgRole: mockUpdateOrgRole,
  disableOrgRole: mockDisableOrgRole,
}));

const controller = await import('./org-roles.controller.js');

const ROLE_ID = '11111111-1111-1111-1111-111111111111';
const DEPARTMENT_ID = '33333333-3333-3333-3333-333333333333';

function createRequest(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: { id: ROLE_ID }, query: {}, ...overrides } as unknown as Request;
}

function createResponse() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('org roles controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards list query and returns the success envelope', async () => {
    const query = { search: 'adv', isActive: true, departmentId: DEPARTMENT_ID };
    const data = [{ id: ROLE_ID, code: 'ADV' }];
    const res = createResponse();
    mockListOrgRoles.mockResolvedValue(data);

    await controller.listOrgRoles(createRequest({ query }), res);
    expect(mockListOrgRoles).toHaveBeenCalledWith(query);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('forwards the role id and returns a detail envelope', async () => {
    const data = { id: ROLE_ID, code: 'ADV' };
    const res = createResponse();
    mockGetOrgRoleById.mockResolvedValue(data);

    await controller.getOrgRoleById(createRequest(), res);
    expect(mockGetOrgRoleById).toHaveBeenCalledWith(ROLE_ID);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('creates with status 201 and forwards the body unchanged', async () => {
    const body = { code: 'ADV', name: 'Advisor', departmentId: DEPARTMENT_ID };
    const data = { id: ROLE_ID, ...body };
    const res = createResponse();
    mockCreateOrgRole.mockResolvedValue(data);

    await controller.createOrgRole(createRequest({ body }), res);
    expect(mockCreateOrgRole).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('forwards the update id and body in a success envelope', async () => {
    const body = { name: 'Lead Advisor', departmentId: null, isActive: false };
    const data = { id: ROLE_ID, code: 'LEAD', ...body };
    const res = createResponse();
    mockUpdateOrgRole.mockResolvedValue(data);

    await controller.updateOrgRole(createRequest({ body }), res);
    expect(mockUpdateOrgRole).toHaveBeenCalledWith(ROLE_ID, body);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('disables the requested role and returns null data', async () => {
    const res = createResponse();
    mockDisableOrgRole.mockResolvedValue(undefined);

    await controller.disableOrgRole(createRequest(), res);
    expect(mockDisableOrgRole).toHaveBeenCalledWith(ROLE_ID);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('propagates service errors without writing alternate responses', async () => {
    const error = new Error('Org role unavailable');
    const res = createResponse();
    mockGetOrgRoleById.mockRejectedValue(error);

    await expect(controller.getOrgRoleById(createRequest(), res)).rejects.toBe(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
