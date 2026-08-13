import type { ListEmployeesQuery } from '@bopacorp/shared/core';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockGetOrgRoleById = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    transaction: mockTransaction,
  },
}));
vi.mock('@lib/audit.js', () => ({ createAuditLog: mockCreateAuditLog }));
vi.mock('../org-roles/org-roles.service.js', () => ({ getOrgRoleById: mockGetOrgRoleById }));

const service = await import('./employees.service.js');

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const ROLE_ID = '33333333-3333-3333-3333-333333333333';
const NOW = new Date('2026-08-13T12:00:00.000Z');
const clientInfo = { ipAddress: '203.0.113.8', userAgent: 'Vitest/1.0' };

function hasQueryValue(expression: unknown, expected: unknown): boolean {
  if (expression === expected) return true;
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { value?: unknown; queryChunks?: unknown[] };
  if (candidate.value === expected) return true;
  if (Array.isArray(candidate.value) && candidate.value.includes(expected)) return true;
  return candidate.queryChunks?.some((chunk) => hasQueryValue(chunk, expected)) ?? false;
}

function hasColumnName(expression: unknown, expected: string): boolean {
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { name?: unknown; queryChunks?: unknown[] };
  return (
    candidate.name === expected ||
    candidate.queryChunks?.some((chunk) => hasColumnName(chunk, expected)) === true
  );
}

function createSelectBuilder(result: unknown, paginated = false) {
  const builder = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  if (paginated) {
    builder.where.mockReturnValue(builder);
    builder.offset.mockResolvedValue(result);
  } else {
    builder.where.mockResolvedValue(result);
  }
  return builder;
}

function setSelectResults(...entries: Array<{ result: unknown; paginated?: boolean }>) {
  return entries.map(({ result, paginated = false }) => {
    const builder = createSelectBuilder(result, paginated);
    mockSelect.mockReturnValueOnce(builder);
    return builder;
  });
}

function employeeRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    orgRoleId: ROLE_ID,
    territory: 'Coast',
    hiredAt: '2024-02-01',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    deletedAt: null,
    userUsername: 'jdoe',
    userEmail: 'jdoe@example.com',
    userIsActive: true,
    userLockedUntil: new Date('2099-01-01T00:00:00.000Z'),
    profileFirstName: 'John',
    profileLastName: 'Doe',
    profileAvatarUrl: 'https://example.com/avatar.png',
    orgRoleCode: 'advisor',
    orgRoleName: 'Advisor',
    deptId: '44444444-4444-4444-4444-444444444444',
    deptCode: 'ADV',
    deptName: 'Advising',
    ...overrides,
  };
}

function detailQueries(row = employeeRow()) {
  return setSelectResults(
    { result: [row] },
    {
      result: [
        {
          userId: '55555555-5555-5555-5555-555555555555',
          username: 'supervisor',
          firstName: 'Sue',
          lastName: 'Pervis',
        },
      ],
    },
    {
      result: [
        {
          userId: '66666666-6666-6666-6666-666666666666',
          username: 'advisor',
          firstName: 'Ada',
          lastName: 'Visor',
        },
      ],
    }
  );
}

describe('employees service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
    mockUpdate.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) });
    mockGetOrgRoleById.mockResolvedValue({ id: ROLE_ID });
    mockCreateAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it('lists filtered, sorted, paginated employees with derived lock status', async () => {
    const [countBuilder, rowsBuilder] = setSelectResults(
      { result: [{ count: 3 }] },
      { result: [employeeRow()], paginated: true }
    );
    const query: ListEmployeesQuery = {
      page: 2,
      limit: 2,
      isActive: true,
      orgRoleId: ROLE_ID,
      orgRoleCode: 'advisor',
      departmentId: '44444444-4444-4444-4444-444444444444',
      search: 'john',
      sortBy: 'email',
      sortOrder: 'desc',
      includeLockStatus: true,
    };

    await expect(service.listEmployees(query)).resolves.toEqual({
      data: [
        expect.objectContaining({
          userId: USER_ID,
          isLocked: true,
          user: expect.objectContaining({ firstName: 'John' }),
        }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    const where = rowsBuilder?.where.mock.calls[0]?.[0];
    const order = rowsBuilder?.orderBy.mock.calls[0]?.[0];
    expect(countBuilder?.where).toHaveBeenCalledWith(where);
    expect(hasQueryValue(where, true)).toBe(true);
    expect(hasQueryValue(where, ROLE_ID)).toBe(true);
    expect(hasQueryValue(where, 'advisor')).toBe(true);
    expect(hasQueryValue(where, '44444444-4444-4444-4444-444444444444')).toBe(true);
    expect(hasQueryValue(where, '%john%')).toBe(true);
    expect(hasColumnName(order, 'email')).toBe(true);
    expect(hasQueryValue(order, ' desc')).toBe(true);
    expect(rowsBuilder?.limit).toHaveBeenCalledWith(2);
    expect(rowsBuilder?.offset).toHaveBeenCalledWith(2);
  });

  it('returns empty pages and only includes lock state when requested', async () => {
    setSelectResults({ result: [{ count: 0 }] }, { result: [], paginated: true });
    await expect(service.listEmployees({ page: 1, limit: 10, sortOrder: 'asc' })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });

    setSelectResults(
      { result: [{ count: 1 }] },
      {
        result: [employeeRow({ userLockedUntil: new Date('2026-01-01T00:00:00.000Z') })],
        paginated: true,
      }
    );
    const result = await service.listEmployees({ page: 1, limit: 10, sortOrder: 'asc' });
    expect(result.data[0]).not.toHaveProperty('isLocked');
  });

  it('marks expired locks and deactivated users as unlocked', async () => {
    setSelectResults(
      { result: [{ count: 3 }] },
      {
        result: [
          employeeRow({ userLockedUntil: new Date('2026-01-01T00:00:00.000Z') }),
          employeeRow({ userId: '77777777-7777-7777-7777-777777777777', userIsActive: false }),
          employeeRow({
            userId: '88888888-8888-8888-8888-888888888888',
            userLockedUntil: NOW,
          }),
        ],
        paginated: true,
      }
    );
    const result = await service.listEmployees({
      page: 1,
      limit: 10,
      sortOrder: 'asc',
      includeLockStatus: true,
    });
    expect(result.data.map((employee) => employee.isLocked)).toEqual([false, false, false]);
  });

  it('returns employee detail including profile, department, supervisors, and advisors', async () => {
    detailQueries();
    await expect(service.getEmployeeByUserId(USER_ID)).resolves.toEqual(
      expect.objectContaining({
        userId: USER_ID,
        user: {
          id: USER_ID,
          username: 'jdoe',
          email: 'jdoe@example.com',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            avatarUrl: 'https://example.com/avatar.png',
          },
        },
        orgRole: {
          id: ROLE_ID,
          code: 'advisor',
          name: 'Advisor',
          department: { id: '44444444-4444-4444-4444-444444444444', code: 'ADV', name: 'Advising' },
        },
        supervisors: [
          {
            userId: '55555555-5555-5555-5555-555555555555',
            username: 'supervisor',
            firstName: 'Sue',
            lastName: 'Pervis',
          },
        ],
        advisors: [
          {
            userId: '66666666-6666-6666-6666-666666666666',
            username: 'advisor',
            firstName: 'Ada',
            lastName: 'Visor',
          },
        ],
      })
    );
    setSelectResults({ result: [] });
    await expect(service.getEmployeeByUserId(USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('validates user, duplicate employee, org role, and failed insert before creating', async () => {
    setSelectResults({ result: [] });
    await expect(
      service.createEmployee(ADMIN_ID, { userId: USER_ID, orgRoleId: ROLE_ID }, clientInfo)
    ).rejects.toThrow(NotFoundError);

    setSelectResults({ result: [{ id: USER_ID }] }, { result: [{ userId: USER_ID }] });
    await expect(
      service.createEmployee(ADMIN_ID, { userId: USER_ID, orgRoleId: ROLE_ID }, clientInfo)
    ).rejects.toThrow(ConflictError);

    setSelectResults({ result: [{ id: USER_ID }] }, { result: [] });
    mockGetOrgRoleById.mockRejectedValueOnce(new NotFoundError('Organizational role', ROLE_ID));
    await expect(
      service.createEmployee(ADMIN_ID, { userId: USER_ID, orgRoleId: ROLE_ID }, clientInfo)
    ).rejects.toThrow(NotFoundError);

    setSelectResults({ result: [{ id: USER_ID }] }, { result: [] });
    mockInsert.mockReturnValueOnce({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    });
    await expect(
      service.createEmployee(ADMIN_ID, { userId: USER_ID, orgRoleId: ROLE_ID }, clientInfo)
    ).rejects.toThrow(InternalServerError);
  });

  it('creates an employee, audits actor/client/new data, and returns detail', async () => {
    const input = {
      userId: USER_ID,
      orgRoleId: ROLE_ID,
      territory: 'Coast',
      hiredAt: '2024-02-01',
    };
    setSelectResults({ result: [{ id: USER_ID }] }, { result: [] });
    mockInsert.mockReturnValueOnce({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ userId: USER_ID }]) })),
    });
    detailQueries();
    const result = await service.createEmployee(ADMIN_ID, input, clientInfo);
    expect(result.userId).toBe(USER_ID);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'employees',
        recordId: USER_ID,
        operation: 'I',
        userId: ADMIN_ID,
        newData: { orgRoleId: ROLE_ID, territory: 'Coast', hiredAt: '2024-02-01' },
        ...clientInfo,
      })
    );
  });

  it('updates mutable fields including nulls, audits old/new values, and returns detail', async () => {
    detailQueries();
    detailQueries(employeeRow({ territory: null, hiredAt: null }));
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    mockUpdate.mockReturnValue({ set });
    const result = await service.updateEmployee(
      ADMIN_ID,
      USER_ID,
      { orgRoleId: ROLE_ID, territory: null, hiredAt: null, isActive: false },
      clientInfo
    );
    expect(result.territory).toBeNull();
    expect(mockGetOrgRoleById).toHaveBeenCalledWith(ROLE_ID);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        orgRoleId: ROLE_ID,
        territory: null,
        hiredAt: null,
        isActive: false,
      })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'U',
        userId: ADMIN_ID,
        oldData: { orgRoleId: ROLE_ID, territory: 'Coast', isActive: true },
        newData: { orgRoleId: ROLE_ID, territory: null, isActive: false },
        ...clientInfo,
      })
    );
  });

  it('propagates missing employees and organizational roles during update', async () => {
    setSelectResults({ result: [] });
    await expect(
      service.updateEmployee(ADMIN_ID, USER_ID, { territory: 'North' }, clientInfo)
    ).rejects.toThrow(NotFoundError);

    detailQueries();
    mockGetOrgRoleById.mockRejectedValueOnce(new NotFoundError('Organizational role', ROLE_ID));
    await expect(
      service.updateEmployee(ADMIN_ID, USER_ID, { orgRoleId: ROLE_ID }, clientInfo)
    ).rejects.toThrow(NotFoundError);
  });

  it('soft-deletes an employee and all advisor-supervisor assignments in a transaction', async () => {
    detailQueries();
    const employeeWhere = vi.fn().mockResolvedValue([]);
    const advisorWhere = vi.fn().mockResolvedValue([]);
    const employeeSet = vi.fn(() => ({ where: employeeWhere }));
    const advisorSet = vi.fn(() => ({ where: advisorWhere }));
    const txUpdate = vi
      .fn()
      .mockReturnValueOnce({ set: employeeSet })
      .mockReturnValueOnce({ set: advisorSet });
    mockTransaction.mockImplementation(async (callback) => callback({ update: txUpdate }));
    await service.deleteEmployee(ADMIN_ID, USER_ID, clientInfo);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(2);
    expect(employeeSet).toHaveBeenCalledWith({
      deletedAt: NOW,
      isActive: false,
      updatedAt: NOW,
    });
    expect(advisorSet).toHaveBeenCalledWith({ isActive: false });
    expect(hasQueryValue(employeeWhere.mock.calls[0]?.[0], USER_ID)).toBe(true);
    expect(hasQueryValue(advisorWhere.mock.calls[0]?.[0], USER_ID)).toBe(true);
    expect(hasColumnName(advisorWhere.mock.calls[0]?.[0], 'advisor_id')).toBe(true);
    expect(hasColumnName(advisorWhere.mock.calls[0]?.[0], 'supervisor_id')).toBe(true);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'D',
        recordId: USER_ID,
        userId: ADMIN_ID,
        ...clientInfo,
      })
    );
  });
});
