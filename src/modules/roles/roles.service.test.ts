import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    transaction: mockTransaction,
  },
}));

const {
  assignRolePermissions,
  createModule,
  createPermission,
  createRole,
  disableModule,
  disablePermission,
  disableRole,
  getModuleById,
  getModuleTree,
  getPermissionById,
  getRoleById,
  getRoleDetail,
  listModules,
  listPermissions,
  listRoles,
  updateModule,
  updatePermission,
  updateRole,
} = await import('./roles.service.js');

const ROLE_ID = '11111111-1111-1111-1111-111111111111';
const MODULE_ID = '22222222-2222-2222-2222-222222222222';
const CHILD_ID = '33333333-3333-3333-3333-333333333333';
const ORPHAN_ID = '44444444-4444-4444-4444-444444444444';
const PERMISSION_ID = '55555555-5555-5555-5555-555555555555';
const NOW = new Date('2026-08-12T12:00:00.000Z');

function makeRole(overrides: Record<string, unknown> = {}) {
  return {
    id: ROLE_ID,
    name: 'Administrator',
    slug: 'administrator',
    description: 'System administration',
    isActive: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeModule(overrides: Record<string, unknown> = {}) {
  return {
    id: MODULE_ID,
    parentId: null,
    name: 'Users',
    code: 'users',
    description: 'User administration',
    sortOrder: 1,
    isActive: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makePermission(overrides: Record<string, unknown> = {}) {
  return {
    id: PERMISSION_ID,
    moduleId: MODULE_ID,
    code: 'users.read',
    name: 'Read users',
    description: 'Read users',
    type: 'READ',
    isActive: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    ...overrides,
  };
}

function hasQueryValue(expression: unknown, expectedValue: unknown): boolean {
  if (expression === expectedValue) return true;
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { queryChunks?: unknown[]; value?: unknown };
  if (candidate.value === expectedValue) return true;
  if (Array.isArray(candidate.value) && candidate.value.includes(expectedValue)) return true;
  return candidate.queryChunks?.some((chunk) => hasQueryValue(chunk, expectedValue)) ?? false;
}

function hasColumnName(expression: unknown, expectedName: string): boolean {
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { name?: unknown; queryChunks?: unknown[] };
  if (candidate.name === expectedName) return true;
  return candidate.queryChunks?.some((chunk) => hasColumnName(chunk, expectedName)) ?? false;
}

type SelectMode = 'where' | 'order' | 'paginated';

function createSelectBuilder(result: unknown, mode: SelectMode = 'where') {
  const builder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  if (mode === 'where') builder.where.mockResolvedValue(result);
  if (mode === 'order') {
    builder.where.mockReturnValue(builder);
    builder.orderBy.mockResolvedValue(result);
  }
  if (mode === 'paginated') {
    builder.where.mockReturnValue(builder);
    builder.orderBy.mockReturnValue(builder);
    builder.offset.mockResolvedValue(result);
  }
  return builder;
}

function setSelectResults(...items: Array<{ result: unknown; mode?: SelectMode }>) {
  return items.map(({ result, mode }) => {
    const builder = createSelectBuilder(result, mode);
    mockSelect.mockReturnValueOnce(builder);
    return builder;
  });
}

function setInsertResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn(() => ({ returning }));
  mockInsert.mockReturnValueOnce({ values });
  return { values, returning };
}

function setUpdateResult(result: unknown, returning = true) {
  const where = vi.fn();
  const set = vi.fn(() => ({ where }));
  mockUpdate.mockReturnValueOnce({ set });
  if (returning) where.mockReturnValue({ returning: vi.fn().mockResolvedValue(result) });
  else where.mockResolvedValue(result);
  return { set, where };
}

function createTransaction() {
  const deleteWhere = vi.fn().mockResolvedValue([]);
  const remove = vi.fn(() => ({ where: deleteWhere }));
  const values = vi.fn().mockResolvedValue([]);
  const insert = vi.fn(() => ({ values }));
  return { tx: { delete: remove, insert }, remove, deleteWhere, insert, values };
}

describe('roles service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('lists roles with filters, descending sort, pagination, and metadata', async () => {
    const [countBuilder, rowsBuilder] = setSelectResults(
      { result: [{ count: 3 }] },
      { result: [makeRole()], mode: 'paginated' }
    );

    await expect(
      listRoles({
        page: 2,
        limit: 2,
        search: 'admin',
        isActive: true,
        sortBy: 'slug',
        sortOrder: 'desc',
      })
    ).resolves.toEqual({
      data: [makeRole()],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(hasQueryValue(rowsBuilder?.where.mock.calls[0]?.[0], '%admin%')).toBe(true);
    expect(hasQueryValue(rowsBuilder?.where.mock.calls[0]?.[0], true)).toBe(true);
    expect(hasColumnName(rowsBuilder?.orderBy.mock.calls[0]?.[0], 'slug')).toBe(true);
    expect(hasQueryValue(rowsBuilder?.orderBy.mock.calls[0]?.[0], ' desc')).toBe(true);
    expect(rowsBuilder?.limit).toHaveBeenCalledWith(2);
    expect(rowsBuilder?.offset).toHaveBeenCalledWith(2);
    expect(countBuilder?.where).toHaveBeenCalledTimes(1);
  });

  it('returns empty role, module, and permission pages', async () => {
    setSelectResults({ result: [{ count: 0 }] }, { result: [], mode: 'paginated' });
    await expect(listRoles({ page: 1, limit: 10 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    setSelectResults({ result: [{ count: 0 }] }, { result: [], mode: 'paginated' });
    await expect(listModules({ page: 1, limit: 10 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    setSelectResults({ result: [{ count: 0 }] }, { result: [], mode: 'paginated' });
    await expect(listPermissions({ page: 1, limit: 10 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it('lists modules and permissions with their supported filters, descending sort, pagination, and metadata', async () => {
    const [, moduleRows] = setSelectResults(
      { result: [{ count: 1 }] },
      { result: [makeModule()], mode: 'paginated' }
    );
    await expect(
      listModules({
        page: 1,
        limit: 5,
        search: 'user',
        isActive: true,
        parentId: MODULE_ID,
        sortBy: 'sortOrder',
        sortOrder: 'desc',
      })
    ).resolves.toEqual({
      data: [makeModule()],
      meta: { page: 1, limit: 5, totalItems: 1, totalPages: 1 },
    });
    expect(hasQueryValue(moduleRows?.where.mock.calls[0]?.[0], '%user%')).toBe(true);
    expect(hasQueryValue(moduleRows?.where.mock.calls[0]?.[0], true)).toBe(true);
    expect(hasQueryValue(moduleRows?.where.mock.calls[0]?.[0], MODULE_ID)).toBe(true);
    expect(hasColumnName(moduleRows?.orderBy.mock.calls[0]?.[0], 'sort_order')).toBe(true);
    expect(hasQueryValue(moduleRows?.orderBy.mock.calls[0]?.[0], ' desc')).toBe(true);
    expect(moduleRows?.limit).toHaveBeenCalledWith(5);
    expect(moduleRows?.offset).toHaveBeenCalledWith(0);

    const [, permissionRows] = setSelectResults(
      { result: [{ count: 1 }] },
      { result: [makePermission()], mode: 'paginated' }
    );
    await expect(
      listPermissions({
        page: 1,
        limit: 5,
        search: 'read',
        isActive: true,
        moduleId: MODULE_ID,
        type: 'READ',
        sortBy: 'code',
        sortOrder: 'desc',
      })
    ).resolves.toEqual({
      data: [makePermission()],
      meta: { page: 1, limit: 5, totalItems: 1, totalPages: 1 },
    });
    expect(hasQueryValue(permissionRows?.where.mock.calls[0]?.[0], '%read%')).toBe(true);
    expect(hasQueryValue(permissionRows?.where.mock.calls[0]?.[0], true)).toBe(true);
    expect(hasQueryValue(permissionRows?.where.mock.calls[0]?.[0], MODULE_ID)).toBe(true);
    expect(hasQueryValue(permissionRows?.where.mock.calls[0]?.[0], 'READ')).toBe(true);
    expect(hasColumnName(permissionRows?.orderBy.mock.calls[0]?.[0], 'code')).toBe(true);
    expect(hasQueryValue(permissionRows?.orderBy.mock.calls[0]?.[0], ' desc')).toBe(true);
    expect(permissionRows?.limit).toHaveBeenCalledWith(5);
    expect(permissionRows?.offset).toHaveBeenCalledWith(0);
  });

  it('gets role details including granted permissions and rejects missing role lookups', async () => {
    setSelectResults(
      { result: [makeRole()] },
      {
        result: [
          {
            permissionId: PERMISSION_ID,
            code: 'users.read',
            name: 'Read users',
            type: 'READ',
            isGranted: true,
          },
        ],
      }
    );
    await expect(getRoleDetail(ROLE_ID)).resolves.toEqual({
      ...makeRole(),
      permissions: [
        {
          id: PERMISSION_ID,
          code: 'users.read',
          name: 'Read users',
          type: 'READ',
          isGranted: true,
        },
      ],
    });
    setSelectResults({ result: [] });
    await expect(getRoleById(ROLE_ID)).rejects.toThrow(NotFoundError);
    setSelectResults({ result: [] });
    await expect(getRoleDetail(ROLE_ID)).rejects.toThrow(NotFoundError);
  });

  it('creates roles after name and slug checks, and rejects conflicts or failed writes', async () => {
    const input = { name: 'Manager', slug: 'manager', description: 'Manages teams' };
    setSelectResults({ result: [makeRole()] });
    await expect(createRole(input)).rejects.toThrow(ConflictError);
    setSelectResults({ result: [] }, { result: [makeRole()] });
    await expect(createRole(input)).rejects.toThrow(ConflictError);
    setSelectResults({ result: [] }, { result: [] });
    const insert = setInsertResult([makeRole(input)]);
    await expect(createRole(input)).resolves.toEqual(makeRole(input));
    expect(insert.values).toHaveBeenCalledWith(input);
    setSelectResults({ result: [] }, { result: [] });
    setInsertResult([]);
    await expect(createRole(input)).rejects.toThrow(InternalServerError);
  });

  it('updates roles with uniqueness protection and disables existing roles', async () => {
    setSelectResults({ result: [makeRole()] }, { result: [makeRole({ id: CHILD_ID })] });
    await expect(updateRole(ROLE_ID, { name: 'Manager' })).rejects.toThrow(ConflictError);
    setSelectResults({ result: [makeRole()] }, { result: [makeRole()] });
    const update = setUpdateResult([
      makeRole({ name: 'Administrator II', description: null, isActive: false }),
    ]);
    await expect(
      updateRole(ROLE_ID, { name: 'Administrator II', description: null, isActive: false })
    ).resolves.toMatchObject({ name: 'Administrator II', isActive: false });
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Administrator II',
        description: null,
        isActive: false,
        updatedAt: NOW,
      })
    );
    setSelectResults({ result: [makeRole()] });
    const disable = setUpdateResult([], false);
    await disableRole(ROLE_ID);
    expect(disable.set).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });
  });

  it('replaces role permissions transactionally for populated and empty assignments', async () => {
    const transaction = createTransaction();
    mockTransaction.mockImplementation(
      async (callback: (tx: typeof transaction.tx) => Promise<void>) => callback(transaction.tx)
    );
    setSelectResults(
      { result: [makeRole()] },
      { result: [makeRole()] },
      {
        result: [
          {
            permissionId: PERMISSION_ID,
            code: 'users.read',
            name: 'Read users',
            type: 'READ',
            isGranted: true,
          },
        ],
      }
    );
    await expect(
      assignRolePermissions(ROLE_ID, {
        permissions: [{ permissionId: PERMISSION_ID, isGranted: true }],
      })
    ).resolves.toMatchObject({
      id: ROLE_ID,
      permissions: [{ id: PERMISSION_ID, isGranted: true }],
    });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.deleteWhere).toHaveBeenCalledTimes(1);
    expect(hasQueryValue(transaction.deleteWhere.mock.calls[0]?.[0], ROLE_ID)).toBe(true);
    expect(transaction.values).toHaveBeenCalledWith([
      { roleId: ROLE_ID, permissionId: PERMISSION_ID, isGranted: true },
    ]);

    const emptyTransaction = createTransaction();
    mockTransaction.mockImplementationOnce(
      async (callback: (tx: typeof emptyTransaction.tx) => Promise<void>) =>
        callback(emptyTransaction.tx)
    );
    setSelectResults({ result: [makeRole()] }, { result: [makeRole()] }, { result: [] });
    await assignRolePermissions(ROLE_ID, { permissions: [] });
    expect(emptyTransaction.deleteWhere).toHaveBeenCalledTimes(1);
    expect(emptyTransaction.insert).not.toHaveBeenCalled();
  });

  it('gets modules and creates them with parent and code validation', async () => {
    setSelectResults({ result: [] });
    await expect(getModuleById(MODULE_ID)).rejects.toThrow(NotFoundError);
    const input = {
      parentId: MODULE_ID,
      name: 'Roles',
      code: 'roles',
      description: 'RBAC',
      sortOrder: 2,
    };
    const [missingParentBuilder] = setSelectResults({ result: [] });
    await expect(createModule(input)).rejects.toThrow(NotFoundError);
    expect(hasQueryValue(missingParentBuilder?.where.mock.calls[0]?.[0], input.parentId)).toBe(
      true
    );
    setSelectResults({ result: [makeModule()] }, { result: [makeModule()] });
    await expect(createModule(input)).rejects.toThrow(ConflictError);
    setSelectResults({ result: [makeModule()] }, { result: [] });
    setInsertResult([makeModule(input)]);
    await expect(createModule(input)).resolves.toEqual(makeModule(input));
    setSelectResults({ result: [] });
    setInsertResult([]);
    await expect(createModule({ name: 'Roles', code: 'roles', sortOrder: 2 })).rejects.toThrow(
      InternalServerError
    );
  });

  it('builds a deterministic module tree, retaining orphaned modules as roots', async () => {
    const [treeBuilder] = setSelectResults({
      result: [
        makeModule(),
        makeModule({
          id: CHILD_ID,
          parentId: MODULE_ID,
          name: 'Roles',
          code: 'roles',
          sortOrder: 2,
        }),
        makeModule({
          id: ORPHAN_ID,
          parentId: PERMISSION_ID,
          name: 'Orphan',
          code: 'orphan',
          sortOrder: 3,
        }),
      ],
      mode: 'order',
    });
    await expect(getModuleTree()).resolves.toEqual([
      expect.objectContaining({
        id: MODULE_ID,
        children: [expect.objectContaining({ id: CHILD_ID, children: [] })],
      }),
      expect.objectContaining({ id: ORPHAN_ID, children: [] }),
    ]);
    const treeOrder = treeBuilder?.orderBy.mock.calls[0] ?? [];
    expect(treeBuilder?.orderBy).toHaveBeenCalledTimes(1);
    expect(treeOrder.some((expression) => hasColumnName(expression, 'sort_order'))).toBe(true);
    expect(treeOrder.some((expression) => hasColumnName(expression, 'name'))).toBe(true);
    expect(treeOrder.every((expression) => hasQueryValue(expression, ' asc'))).toBe(true);
  });

  it('updates and disables modules after validating existing and parent records', async () => {
    const [, parentValidationBuilder] = setSelectResults(
      { result: [makeModule()] },
      { result: [makeModule()] }
    );
    const update = setUpdateResult([
      makeModule({ parentId: CHILD_ID, name: 'Users and roles', sortOrder: 9, isActive: false }),
    ]);
    await updateModule(MODULE_ID, {
      parentId: CHILD_ID,
      name: 'Users and roles',
      sortOrder: 9,
      isActive: false,
    });
    expect(hasQueryValue(parentValidationBuilder?.where.mock.calls[0]?.[0], CHILD_ID)).toBe(true);
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: CHILD_ID, sortOrder: 9, isActive: false, updatedAt: NOW })
    );
    setSelectResults({ result: [makeModule()] });
    const disable = setUpdateResult([], false);
    await disableModule(MODULE_ID);
    expect(disable.set).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });
    setSelectResults({ result: [makeModule()] });
    setUpdateResult([]);
    await expect(updateModule(MODULE_ID, { name: 'Missing write' })).rejects.toThrow(NotFoundError);
  });

  it('gets, creates, updates, and disables permissions with validation and failed-write coverage', async () => {
    setSelectResults({ result: [] });
    await expect(getPermissionById(PERMISSION_ID)).rejects.toThrow(NotFoundError);
    const input = {
      moduleId: MODULE_ID,
      code: 'users.write',
      name: 'Write users',
      description: 'Write users',
      type: 'WRITE' as const,
    };
    const [missingModuleBuilder] = setSelectResults({ result: [] });
    await expect(createPermission(input)).rejects.toThrow(NotFoundError);
    expect(hasQueryValue(missingModuleBuilder?.where.mock.calls[0]?.[0], input.moduleId)).toBe(
      true
    );
    setSelectResults({ result: [makeModule()] }, { result: [makePermission()] });
    await expect(createPermission(input)).rejects.toThrow(ConflictError);
    setSelectResults({ result: [makeModule()] }, { result: [] });
    setInsertResult([makePermission(input)]);
    await expect(createPermission(input)).resolves.toEqual(makePermission(input));
    setSelectResults({ result: [makeModule()] }, { result: [] });
    setInsertResult([]);
    await expect(createPermission(input)).rejects.toThrow(InternalServerError);
    setSelectResults({ result: [makePermission()] });
    const update = setUpdateResult([makePermission({ name: 'Write all users', isActive: false })]);
    await updatePermission(PERMISSION_ID, { name: 'Write all users', isActive: false });
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Write all users', isActive: false, updatedAt: NOW })
    );
    setSelectResults({ result: [makePermission()] });
    const disable = setUpdateResult([], false);
    await disablePermission(PERMISSION_ID);
    expect(disable.set).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });
    setSelectResults({ result: [makePermission()] });
    setUpdateResult([]);
    await expect(updatePermission(PERMISSION_ID, { name: 'Failed write' })).rejects.toThrow(
      NotFoundError
    );
  });
});
