import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListRoles = vi.fn();
const mockGetRoleDetail = vi.fn();
const mockCreateRole = vi.fn();
const mockUpdateRole = vi.fn();
const mockDisableRole = vi.fn();
const mockAssignRolePermissions = vi.fn();
const mockListModules = vi.fn();
const mockGetModuleTree = vi.fn();
const mockGetModuleById = vi.fn();
const mockCreateModule = vi.fn();
const mockUpdateModule = vi.fn();
const mockDisableModule = vi.fn();
const mockListPermissions = vi.fn();
const mockGetPermissionById = vi.fn();
const mockCreatePermission = vi.fn();
const mockUpdatePermission = vi.fn();
const mockDisablePermission = vi.fn();

vi.mock('./roles.service.js', () => ({
  listRoles: mockListRoles,
  getRoleDetail: mockGetRoleDetail,
  createRole: mockCreateRole,
  updateRole: mockUpdateRole,
  disableRole: mockDisableRole,
  assignRolePermissions: mockAssignRolePermissions,
  listModules: mockListModules,
  getModuleTree: mockGetModuleTree,
  getModuleById: mockGetModuleById,
  createModule: mockCreateModule,
  updateModule: mockUpdateModule,
  disableModule: mockDisableModule,
  listPermissions: mockListPermissions,
  getPermissionById: mockGetPermissionById,
  createPermission: mockCreatePermission,
  updatePermission: mockUpdatePermission,
  disablePermission: mockDisablePermission,
}));

const controller = await import('./roles.controller.js');

const ROLE_ID = '11111111-1111-4111-8111-111111111111';
const MODULE_ID = '22222222-2222-4222-8222-222222222222';
const PERMISSION_ID = '33333333-3333-4333-8333-333333333333';

function createResponse() {
  const json = vi.fn();
  const status = vi.fn();
  const response = { json, status };
  status.mockReturnValue(response);
  return response as unknown as Response;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: { id: ROLE_ID },
    query: {},
    ...overrides,
  } as unknown as Request;
}

describe('roles controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['roles', controller.listRoles, mockListRoles, { page: 2, limit: 10, search: 'admin' }],
    ['modules', controller.listModules, mockListModules, { page: 1, limit: 20, sortOrder: 'asc' }],
    [
      'permissions',
      controller.listPermissions,
      mockListPermissions,
      { page: 3, limit: 5, moduleId: MODULE_ID },
    ],
  ])('returns the %s list envelope and forwards the query', async (_name, action, service, query) => {
    const result = {
      data: [{ id: ROLE_ID, name: 'Administrators' }],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    };
    const res = createResponse();
    service.mockResolvedValue(result);

    await action(createRequest({ query }), res);

    expect(service).toHaveBeenCalledWith(query);
    expect(res.json).toHaveBeenCalledWith({ success: true, ...result });
  });

  it.each([
    ['role', controller.getRoleById, mockGetRoleDetail, ROLE_ID],
    ['module', controller.getModuleById, mockGetModuleById, MODULE_ID],
    ['permission', controller.getPermissionById, mockGetPermissionById, PERMISSION_ID],
  ])('returns the %s detail envelope and forwards the id', async (_name, action, service, id) => {
    const data = { id, name: 'Record' };
    const res = createResponse();
    service.mockResolvedValue(data);

    await action(createRequest({ params: { id } }), res);

    expect(service).toHaveBeenCalledWith(id);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('returns the module tree envelope', async () => {
    const data = [{ id: MODULE_ID, name: 'Administration', children: [] }];
    const res = createResponse();
    mockGetModuleTree.mockResolvedValue(data);

    await controller.getModuleTree(createRequest(), res);

    expect(mockGetModuleTree).toHaveBeenCalledWith();
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it.each([
    ['role', controller.createRole, mockCreateRole, { name: 'Administrators', slug: 'admin' }],
    [
      'module',
      controller.createModule,
      mockCreateModule,
      { name: 'Administration', code: 'ADMIN', path: '/admin' },
    ],
    [
      'permission',
      controller.createPermission,
      mockCreatePermission,
      { moduleId: MODULE_ID, name: 'Read roles', code: 'roles.read' },
    ],
  ])('returns 201 when creating a %s and forwards its body', async (_name, action, service, body) => {
    const data = { id: ROLE_ID, ...body };
    const res = createResponse();
    service.mockResolvedValue(data);

    await action(createRequest({ body }), res);

    expect(service).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it.each([
    ['role', controller.updateRole, mockUpdateRole, ROLE_ID, { name: 'Platform administrators' }],
    ['module', controller.updateModule, mockUpdateModule, MODULE_ID, { name: 'Admin tools' }],
    [
      'permission',
      controller.updatePermission,
      mockUpdatePermission,
      PERMISSION_ID,
      { name: 'Read all roles' },
    ],
  ])('returns the updated %s envelope and forwards id and body', async (_name, action, service, id, body) => {
    const data = { id, ...body };
    const res = createResponse();
    service.mockResolvedValue(data);

    await action(createRequest({ params: { id }, body }), res);

    expect(service).toHaveBeenCalledWith(id, body);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('returns the assigned permissions envelope and forwards the role id and body', async () => {
    const body = { permissions: [{ permissionId: PERMISSION_ID, isGranted: true }] };
    const data = { id: ROLE_ID, permissions: [{ id: PERMISSION_ID, code: 'roles.read' }] };
    const res = createResponse();
    mockAssignRolePermissions.mockResolvedValue(data);

    await controller.assignPermissions(createRequest({ body }), res);

    expect(mockAssignRolePermissions).toHaveBeenCalledWith(ROLE_ID, body);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it.each([
    ['role', controller.disableRole, mockDisableRole, ROLE_ID],
    ['module', controller.disableModule, mockDisableModule, MODULE_ID],
    ['permission', controller.disablePermission, mockDisablePermission, PERMISSION_ID],
  ])('disables the %s and returns a null-data success envelope', async (_name, action, service, id) => {
    const res = createResponse();
    service.mockResolvedValue(undefined);

    await action(createRequest({ params: { id } }), res);

    expect(service).toHaveBeenCalledWith(id);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });
});
