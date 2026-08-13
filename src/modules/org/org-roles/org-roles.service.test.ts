import type {
  CreateOrgRoleRequest,
  ListOrgRolesQuery,
  UpdateOrgRoleRequest,
} from '@bopacorp/shared/core';
import { departments, orgRoles } from '@db/schema/core.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockGetDepartmentById = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}));

vi.mock('../departments/departments.service.js', () => ({
  getDepartmentById: mockGetDepartmentById,
}));

const service = await import('./org-roles.service.js');

const ROLE_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ROLE_ID = '22222222-2222-2222-2222-222222222222';
const DEPARTMENT_ID = '33333333-3333-3333-3333-333333333333';
const NOW = new Date('2026-08-13T12:00:00.000Z');

function roleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ROLE_ID,
    code: 'ADV',
    name: 'Advisor',
    departmentId: DEPARTMENT_ID,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function departmentRow(overrides: Record<string, unknown> = {}) {
  return { id: DEPARTMENT_ID, code: 'ACA', name: 'Academic Affairs', isActive: true, ...overrides };
}

function departmentResponse() {
  return { id: DEPARTMENT_ID, code: 'ACA', name: 'Academic Affairs' };
}

function hasQueryValue(expression: unknown, expected: unknown): boolean {
  if (expression === expected) return true;
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { value?: unknown; queryChunks?: unknown[] };
  if (candidate.value === expected) return true;
  if (Array.isArray(candidate.value) && candidate.value.includes(expected)) return true;
  return candidate.queryChunks?.some((chunk) => hasQueryValue(chunk, expected)) ?? false;
}

function hasColumnReference(expression: unknown, expected: object): boolean {
  if (expression === expected) return true;
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { value?: unknown; queryChunks?: unknown[] };
  return (
    hasColumnReference(candidate.value, expected) ||
    candidate.queryChunks?.some((chunk) => hasColumnReference(chunk, expected)) === true
  );
}

function selectResult(result: unknown) {
  const builder = { from: vi.fn(), leftJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  builder.orderBy.mockResolvedValue(result);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function listResult(result: unknown) {
  const builder = { from: vi.fn(), leftJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function insertResult(result: unknown) {
  const builder = { values: vi.fn(), returning: vi.fn() };
  builder.values.mockReturnValue(builder);
  builder.returning.mockResolvedValue(result);
  mockInsert.mockReturnValueOnce(builder);
  return builder;
}

function updateResult() {
  const builder = { set: vi.fn(), where: vi.fn() };
  builder.set.mockReturnValue(builder);
  builder.where.mockResolvedValue(undefined);
  mockUpdate.mockReturnValueOnce(builder);
  return builder;
}

describe('org roles service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('lists populated roles with filters, joins, and code ordering', async () => {
    const query: ListOrgRolesQuery = { search: 'adv', isActive: true, departmentId: DEPARTMENT_ID };
    const rows = [
      { org_roles: roleRow(), departments: departmentRow() },
      { org_roles: roleRow({ id: OTHER_ROLE_ID, departmentId: null }), departments: null },
    ];
    const builder = listResult(rows);

    await expect(service.listOrgRoles(query)).resolves.toEqual([
      { ...rows[0].org_roles, department: departmentResponse() },
      { ...rows[1].org_roles, department: null },
    ]);
    expect(builder.from).toHaveBeenCalledWith(orgRoles);
    expect(builder.leftJoin.mock.calls[0]?.[0]).toBe(departments);
    const joinCondition = builder.leftJoin.mock.calls[0]?.[1];
    expect(hasColumnReference(joinCondition, orgRoles.departmentId)).toBe(true);
    expect(hasColumnReference(joinCondition, departments.id)).toBe(true);
    const condition = builder.where.mock.calls[0]?.[0];
    expect(hasQueryValue(condition, '%adv%')).toBe(true);
    expect(hasQueryValue(condition, true)).toBe(true);
    expect(hasQueryValue(condition, DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(condition, orgRoles.code)).toBe(true);
    expect(hasColumnReference(condition, orgRoles.name)).toBe(true);
    expect(hasColumnReference(condition, orgRoles.isActive)).toBe(true);
    expect(hasColumnReference(condition, orgRoles.departmentId)).toBe(true);
    expect(builder.orderBy).toHaveBeenCalledWith(orgRoles.code);
  });

  it('returns an empty role list without filters', async () => {
    const builder = listResult([]);
    await expect(service.listOrgRoles({})).resolves.toEqual([]);
    expect(builder.where).toHaveBeenCalledWith(undefined);
    expect(builder.orderBy).toHaveBeenCalledWith(orgRoles.code);
  });

  it('hydrates one role by id and rejects a missing role', async () => {
    const row = { org_roles: roleRow(), departments: departmentRow() };
    const foundBuilder = selectResult([row]);
    await expect(service.getOrgRoleById(ROLE_ID)).resolves.toEqual({
      ...row.org_roles,
      department: departmentResponse(),
    });
    expect(foundBuilder.from).toHaveBeenCalledWith(orgRoles);
    expect(foundBuilder.leftJoin.mock.calls[0]?.[0]).toBe(departments);
    const joinCondition = foundBuilder.leftJoin.mock.calls[0]?.[1];
    expect(hasColumnReference(joinCondition, orgRoles.departmentId)).toBe(true);
    expect(hasColumnReference(joinCondition, departments.id)).toBe(true);
    expect(hasQueryValue(foundBuilder.where.mock.calls[0]?.[0], ROLE_ID)).toBe(true);
    expect(hasColumnReference(foundBuilder.where.mock.calls[0]?.[0], orgRoles.id)).toBe(true);

    selectResult([]);
    await expect(service.getOrgRoleById(ROLE_ID)).rejects.toThrow(NotFoundError);
  });

  it('rejects duplicate role codes before validation or insertion', async () => {
    const input: CreateOrgRoleRequest = {
      code: 'ADV',
      name: 'Advisor',
      departmentId: DEPARTMENT_ID,
    };
    const builder = selectResult([roleRow()]);
    await expect(service.createOrgRole(input)).rejects.toThrow(ConflictError);
    expect(builder.from).toHaveBeenCalledWith(orgRoles);
    expect(hasQueryValue(builder.where.mock.calls[0]?.[0], input.code)).toBe(true);
    expect(hasColumnReference(builder.where.mock.calls[0]?.[0], orgRoles.code)).toBe(true);
    expect(mockGetDepartmentById).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('validates the department, inserts, and returns the hydrated role', async () => {
    const input: CreateOrgRoleRequest = {
      code: 'ADV',
      name: 'Advisor',
      departmentId: DEPARTMENT_ID,
    };
    selectResult([]);
    mockGetDepartmentById.mockResolvedValue(departmentRow());
    const insertBuilder = insertResult([roleRow()]);
    selectResult([{ org_roles: roleRow(), departments: departmentRow() }]);

    await expect(service.createOrgRole(input)).resolves.toEqual({
      ...roleRow(),
      department: departmentResponse(),
    });
    expect(mockGetDepartmentById).toHaveBeenCalledWith(DEPARTMENT_ID);
    expect(mockInsert).toHaveBeenCalledWith(orgRoles);
    expect(insertBuilder.values).toHaveBeenCalledWith(input);
    expect(insertBuilder.returning).toHaveBeenCalledWith();
  });

  it('propagates department validation failures and reports a missing inserted row', async () => {
    const input: CreateOrgRoleRequest = {
      code: 'ADV',
      name: 'Advisor',
      departmentId: DEPARTMENT_ID,
    };
    selectResult([]);
    const departmentError = new NotFoundError('Department', DEPARTMENT_ID);
    mockGetDepartmentById.mockRejectedValue(departmentError);
    await expect(service.createOrgRole(input)).rejects.toBe(departmentError);
    expect(mockInsert).not.toHaveBeenCalled();

    selectResult([]);
    mockGetDepartmentById.mockResolvedValue(departmentRow());
    insertResult([]);
    await expect(service.createOrgRole(input)).rejects.toThrow(InternalServerError);
  });

  it('rejects updates for missing roles and conflicting codes', async () => {
    const missingBuilder = selectResult([]);
    await expect(service.updateOrgRole(ROLE_ID, { name: 'New advisor' })).rejects.toThrow(
      NotFoundError
    );
    expect(hasQueryValue(missingBuilder.where.mock.calls[0]?.[0], ROLE_ID)).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();

    selectResult([{ org_roles: roleRow(), departments: departmentRow() }]);
    const duplicateBuilder = selectResult([roleRow({ id: OTHER_ROLE_ID, code: 'LEAD' })]);
    await expect(service.updateOrgRole(ROLE_ID, { code: 'LEAD' })).rejects.toThrow(ConflictError);
    expect(hasQueryValue(duplicateBuilder.where.mock.calls[0]?.[0], 'LEAD')).toBe(true);
    expect(hasColumnReference(duplicateBuilder.where.mock.calls[0]?.[0], orgRoles.code)).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects an update when the supplied department is invalid before writing', async () => {
    selectResult([{ org_roles: roleRow(), departments: departmentRow() }]);
    const departmentError = new NotFoundError('Department', DEPARTMENT_ID);
    mockGetDepartmentById.mockRejectedValue(departmentError);

    await expect(service.updateOrgRole(ROLE_ID, { departmentId: DEPARTMENT_ID })).rejects.toBe(
      departmentError
    );
    expect(mockGetDepartmentById).toHaveBeenCalledWith(DEPARTMENT_ID);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('validates an assigned department, clears nullable departmentId, and returns the refreshed role', async () => {
    const input: UpdateOrgRoleRequest = {
      code: 'LEAD',
      name: 'Lead Advisor',
      departmentId: null,
      isActive: false,
    };
    selectResult([{ org_roles: roleRow(), departments: departmentRow() }]);
    selectResult([]);
    const updateBuilder = updateResult();
    selectResult([
      {
        org_roles: roleRow({
          code: input.code,
          name: input.name,
          departmentId: null,
          isActive: false,
        }),
        departments: null,
      },
    ]);

    await expect(service.updateOrgRole(ROLE_ID, input)).resolves.toEqual({
      ...roleRow({ code: input.code, name: input.name, departmentId: null, isActive: false }),
      department: null,
    });
    expect(mockGetDepartmentById).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(orgRoles);
    expect(updateBuilder.set).toHaveBeenCalledWith({ ...input, updatedAt: NOW });
    expect(hasQueryValue(updateBuilder.where.mock.calls[0]?.[0], ROLE_ID)).toBe(true);
    expect(hasColumnReference(updateBuilder.where.mock.calls[0]?.[0], orgRoles.id)).toBe(true);

    vi.resetAllMocks();
    selectResult([{ org_roles: roleRow(), departments: departmentRow() }]);
    mockGetDepartmentById.mockResolvedValue(departmentRow());
    updateResult();
    selectResult([{ org_roles: roleRow(), departments: departmentRow() }]);
    await service.updateOrgRole(ROLE_ID, { departmentId: DEPARTMENT_ID });
    expect(mockGetDepartmentById).toHaveBeenCalledWith(DEPARTMENT_ID);
  });

  it('checks existence before disabling a role with a timestamp', async () => {
    const existingBuilder = selectResult([{ org_roles: roleRow(), departments: departmentRow() }]);
    const updateBuilder = updateResult();
    await expect(service.disableOrgRole(ROLE_ID)).resolves.toBeUndefined();
    expect(hasQueryValue(existingBuilder.where.mock.calls[0]?.[0], ROLE_ID)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(orgRoles);
    expect(updateBuilder.set).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });
    expect(hasQueryValue(updateBuilder.where.mock.calls[0]?.[0], ROLE_ID)).toBe(true);
    expect(hasColumnReference(updateBuilder.where.mock.calls[0]?.[0], orgRoles.id)).toBe(true);
  });
});
