import type { ListAdvisorSupervisorsQuery } from '@bopacorp/shared/core';
import { advisorSupervisors, employees } from '@db/schema/core.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockGetEmployeeByUserId = vi.fn();

vi.mock('@lib/db.js', () => ({ db: { select: mockSelect, transaction: mockTransaction } }));
vi.mock('@lib/audit.js', () => ({ createAuditLog: mockCreateAuditLog }));
vi.mock('../employees/employees.service.js', () => ({
  getEmployeeByUserId: mockGetEmployeeByUserId,
}));

const service = await import('./advisor-supervisors.service.js');

const ADVISOR_ID = '11111111-1111-1111-1111-111111111111';
const SUPERVISOR_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_SUPERVISOR_ID = '33333333-3333-3333-3333-333333333333';
const ADMIN_ID = '44444444-4444-4444-4444-444444444444';
const ASSIGNED_AT = new Date('2026-08-13T12:00:00.000Z');

function hasValue(expression: unknown, expected: unknown, seen = new Set<object>()): boolean {
  if (expression === expected) return true;
  if (!expression || typeof expression !== 'object') return false;
  if (seen.has(expression)) return false;
  seen.add(expression);
  const candidate = expression as { value?: unknown; queryChunks?: unknown[] };
  if (candidate.value === expected) return true;
  if (Array.isArray(candidate.value) && candidate.value.includes(expected)) return true;
  return Object.values(candidate).some((value) => hasValue(value, expected, seen));
}

function hasColumn(expression: unknown, column: object, seen = new Set<object>()): boolean {
  if (expression === column) return true;
  if (!expression || typeof expression !== 'object') return false;
  if (seen.has(expression)) return false;
  seen.add(expression);
  const candidate = expression as { value?: unknown; queryChunks?: unknown[] };
  return (
    hasColumn(candidate.value, column, seen) ||
    candidate.queryChunks?.some((chunk) => hasColumn(chunk, column, seen)) === true
  );
}

function hasDirectPredicate(
  expression: unknown,
  column: object,
  expectedValue: unknown,
  seen = new Set<object>()
): boolean {
  if (!expression || typeof expression !== 'object' || seen.has(expression)) return false;
  seen.add(expression);
  const candidate = expression as { queryChunks?: unknown[] };
  if (candidate.queryChunks?.includes(column) && hasValue(candidate, expectedValue)) return true;
  return (
    candidate.queryChunks?.some((chunk) =>
      hasDirectPredicate(chunk, column, expectedValue, seen)
    ) === true
  );
}

function isAscendingOrder(expression: unknown, column: object) {
  return hasColumn(expression, column) && hasValue(expression, ' asc');
}

function countQuery(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function rowsQuery(result: unknown) {
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
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockResolvedValue(result);
  mockSelect.mockReturnValueOnce(builder);
  const subquery = { from: vi.fn(), where: vi.fn() };
  subquery.from.mockReturnValue(subquery);
  subquery.where.mockReturnValue(subquery);
  mockSelect.mockReturnValueOnce(subquery).mockReturnValueOnce(subquery);
  return builder;
}

function directQuery(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function assignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    advisorId: ADVISOR_ID,
    supervisorId: SUPERVISOR_ID,
    isActive: true,
    assignedAt: ASSIGNED_AT,
    advUsername: 'advisor.user',
    advEmail: 'advisor@example.com',
    advFirstName: 'Ada',
    advLastName: 'Visor',
    advOrgRoleId: 'role-advisor',
    advOrgRoleName: 'Advisor',
    supUsername: 'supervisor.user',
    supEmail: 'supervisor@example.com',
    supFirstName: null,
    supLastName: null,
    supOrgRoleId: null,
    supOrgRoleName: null,
    ...overrides,
  };
}

const query: ListAdvisorSupervisorsQuery = { page: 2, limit: 10, sortOrder: 'asc' };

describe('advisor-supervisors service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(ASSIGNED_AT);
    mockGetEmployeeByUserId.mockResolvedValue({ userId: ADVISOR_ID });
  });

  afterEach(() => vi.useRealTimers());

  it('lists supervisors scoped to the advisor with filters, pagination, ascending ordering, and mapping', async () => {
    const countBuilder = countQuery([{ count: 11 }]);
    const rowsBuilder = rowsQuery([assignmentRow()]);

    await expect(
      service.listSupervisors(ADVISOR_ID, { ...query, isActive: true })
    ).resolves.toEqual({
      data: [
        {
          advisorId: ADVISOR_ID,
          supervisorId: SUPERVISOR_ID,
          isActive: true,
          assignedAt: ASSIGNED_AT.toISOString(),
          advisor: {
            id: ADVISOR_ID,
            username: 'advisor.user',
            email: 'advisor@example.com',
            profile: { firstName: 'Ada', lastName: 'Visor' },
            orgRole: { id: 'role-advisor', name: 'Advisor' },
          },
          supervisor: {
            id: SUPERVISOR_ID,
            username: 'supervisor.user',
            email: 'supervisor@example.com',
            profile: null,
            orgRole: { id: '', name: '' },
          },
        },
      ],
      meta: { page: 2, limit: 10, totalItems: 11, totalPages: 2 },
    });
    expect(mockGetEmployeeByUserId).toHaveBeenCalledWith(ADVISOR_ID);
    expect(countBuilder.from).toHaveBeenCalledWith(advisorSupervisors);
    const condition = countBuilder.where.mock.calls[0]?.[0];
    expect(hasColumn(condition, advisorSupervisors.advisorId)).toBe(true);
    expect(hasColumn(condition, advisorSupervisors.isActive)).toBe(true);
    expect(hasValue(condition, ADVISOR_ID)).toBe(true);
    expect(hasValue(condition, true)).toBe(true);
    expect(rowsBuilder.where).toHaveBeenCalledWith(condition);
    expect(rowsBuilder.from).toHaveBeenCalledWith(advisorSupervisors);
    expect(rowsBuilder.limit).toHaveBeenCalledWith(10);
    expect(rowsBuilder.offset).toHaveBeenCalledWith(10);
    expect(rowsBuilder.orderBy).toHaveBeenCalledTimes(1);
    expect(
      isAscendingOrder(rowsBuilder.orderBy.mock.calls[0]?.[0], advisorSupervisors.assignedAt)
    ).toBe(true);
  });

  it('lists an empty advisor list scoped to the supervisor without an active filter', async () => {
    const countBuilder = countQuery([{ count: 0 }]);
    const rowsBuilder = rowsQuery([]);
    await expect(
      service.listAdvisors(SUPERVISOR_ID, { page: 1, limit: 5, sortOrder: 'asc' })
    ).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 5, totalItems: 0, totalPages: 0 },
    });
    const condition = countBuilder.where.mock.calls[0]?.[0];
    expect(hasColumn(condition, advisorSupervisors.supervisorId)).toBe(true);
    expect(hasColumn(condition, advisorSupervisors.isActive)).toBe(false);
    expect(hasValue(condition, SUPERVISOR_ID)).toBe(true);
    expect(rowsBuilder.from).toHaveBeenCalledWith(advisorSupervisors);
    expect(rowsBuilder.offset).toHaveBeenCalledWith(0);
    expect(
      isAscendingOrder(rowsBuilder.orderBy.mock.calls[0]?.[0], advisorSupervisors.assignedAt)
    ).toBe(true);
  });

  it('lists advisors scoped to the supervisor with active filtering, pagination, ascending ordering, and nullable advisor mapping', async () => {
    const countBuilder = countQuery([{ count: 6 }]);
    const rowsBuilder = rowsQuery([
      assignmentRow({
        advisorId: OTHER_SUPERVISOR_ID,
        supervisorId: SUPERVISOR_ID,
        assignedAt: null,
        advUsername: null,
        advEmail: null,
        advFirstName: null,
        advLastName: null,
        advOrgRoleId: null,
        advOrgRoleName: null,
        supFirstName: 'Sam',
        supLastName: 'Supervisor',
        supOrgRoleId: 'role-supervisor',
        supOrgRoleName: 'Supervisor',
      }),
    ]);

    await expect(
      service.listAdvisors(SUPERVISOR_ID, { page: 2, limit: 4, sortOrder: 'asc', isActive: false })
    ).resolves.toEqual({
      data: [
        {
          advisorId: OTHER_SUPERVISOR_ID,
          supervisorId: SUPERVISOR_ID,
          isActive: true,
          assignedAt: '',
          advisor: {
            id: OTHER_SUPERVISOR_ID,
            username: '',
            email: '',
            profile: null,
            orgRole: { id: '', name: '' },
          },
          supervisor: {
            id: SUPERVISOR_ID,
            username: 'supervisor.user',
            email: 'supervisor@example.com',
            profile: { firstName: 'Sam', lastName: 'Supervisor' },
            orgRole: { id: 'role-supervisor', name: 'Supervisor' },
          },
        },
      ],
      meta: { page: 2, limit: 4, totalItems: 6, totalPages: 2 },
    });
    const condition = countBuilder.where.mock.calls[0]?.[0];
    expect(hasColumn(condition, advisorSupervisors.supervisorId)).toBe(true);
    expect(hasColumn(condition, advisorSupervisors.isActive)).toBe(true);
    expect(hasValue(condition, SUPERVISOR_ID)).toBe(true);
    expect(hasValue(condition, false)).toBe(true);
    expect(rowsBuilder.where).toHaveBeenCalledWith(condition);
    expect(rowsBuilder.from).toHaveBeenCalledWith(advisorSupervisors);
    expect(rowsBuilder.limit).toHaveBeenCalledWith(4);
    expect(rowsBuilder.offset).toHaveBeenCalledWith(4);
    expect(
      isAscendingOrder(rowsBuilder.orderBy.mock.calls[0]?.[0], advisorSupervisors.assignedAt)
    ).toBe(true);
  });

  it('propagates a missing target employee before issuing list queries', async () => {
    const error = new NotFoundError('Employee', ADVISOR_ID);
    mockGetEmployeeByUserId.mockRejectedValue(error);
    await expect(service.listSupervisors(ADVISOR_ID, query)).rejects.toBe(error);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('propagates a missing assignment target before checking supervisors or mutating rows', async () => {
    const error = new NotFoundError('Employee', ADVISOR_ID);
    mockGetEmployeeByUserId.mockRejectedValue(error);
    await expect(
      service.assignSupervisors(ADMIN_ID, ADVISOR_ID, { supervisorIds: [SUPERVISOR_ID] }, {})
    ).rejects.toBe(error);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('rejects self-assignment without database mutations', async () => {
    await expect(
      service.assignSupervisors(ADMIN_ID, ADVISOR_ID, { supervisorIds: [ADVISOR_ID] }, {})
    ).rejects.toThrow(ConflictError);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('rejects nonexistent supervisors based on the requested set without mutations', async () => {
    const existingBuilder = directQuery([{ userId: SUPERVISOR_ID }]);
    await expect(
      service.assignSupervisors(
        ADMIN_ID,
        ADVISOR_ID,
        { supervisorIds: [SUPERVISOR_ID, OTHER_SUPERVISOR_ID] },
        {}
      )
    ).rejects.toThrow(NotFoundError);
    const condition = existingBuilder.where.mock.calls[0]?.[0];
    expect(existingBuilder.from).toHaveBeenCalledWith(employees);
    expect(hasColumn(condition, employees.userId)).toBe(true);
    expect(hasColumn(condition, employees.deletedAt)).toBe(true);
    expect(hasValue(condition, SUPERVISOR_ID)).toBe(true);
    expect(hasValue(condition, OTHER_SUPERVISOR_ID)).toBe(true);
    expect(hasDirectPredicate(condition, employees.userId, SUPERVISOR_ID)).toBe(true);
    expect(hasDirectPredicate(condition, employees.userId, OTHER_SUPERVISOR_ID)).toBe(true);
    expect(hasDirectPredicate(condition, employees.deletedAt, ' is null')).toBe(true);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('replaces only target advisor assignments, audits old and new ids, and returns refreshed supervisors', async () => {
    directQuery([{ userId: SUPERVISOR_ID }, { userId: OTHER_SUPERVISOR_ID }]);
    const oldBuilder = directQuery([{ supervisorId: 'old-supervisor' }]);
    const txDelete = { where: vi.fn() };
    const txInsert = { values: vi.fn() };
    const txDeleteCall = vi.fn(() => txDelete);
    const txInsertCall = vi.fn(() => txInsert);
    txDelete.where.mockResolvedValue(undefined);
    txInsert.values.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (callback) =>
      callback({ delete: txDeleteCall, insert: txInsertCall })
    );
    const refreshedCountBuilder = countQuery([{ count: 2 }]);
    const refreshedRowsBuilder = rowsQuery([
      assignmentRow(),
      assignmentRow({ supervisorId: OTHER_SUPERVISOR_ID }),
    ]);
    const clientInfo = { ipAddress: '203.0.113.4', userAgent: 'test-agent' };

    await expect(
      service.assignSupervisors(
        ADMIN_ID,
        ADVISOR_ID,
        { supervisorIds: [SUPERVISOR_ID, OTHER_SUPERVISOR_ID] },
        clientInfo
      )
    ).resolves.toMatchObject({
      meta: { page: 1, limit: 100, totalItems: 2, totalPages: 1 },
    });
    const oldCondition = oldBuilder.where.mock.calls[0]?.[0];
    expect(oldBuilder.from).toHaveBeenCalledWith(advisorSupervisors);
    expect(hasColumn(oldCondition, advisorSupervisors.advisorId)).toBe(true);
    expect(hasValue(oldCondition, ADVISOR_ID)).toBe(true);
    expect(txDelete.where).toHaveBeenCalledTimes(1);
    expect(txDeleteCall).toHaveBeenCalledOnce();
    expect(txDeleteCall).toHaveBeenCalledWith(advisorSupervisors);
    expect(txInsertCall).toHaveBeenCalledOnce();
    expect(txInsertCall).toHaveBeenCalledWith(advisorSupervisors);
    const deleteCondition = txDelete.where.mock.calls[0]?.[0];
    expect(hasColumn(deleteCondition, advisorSupervisors.advisorId)).toBe(true);
    expect(hasValue(deleteCondition, ADVISOR_ID)).toBe(true);
    expect(txInsert.values).toHaveBeenCalledWith([
      { advisorId: ADVISOR_ID, supervisorId: SUPERVISOR_ID },
      { advisorId: ADVISOR_ID, supervisorId: OTHER_SUPERVISOR_ID },
    ]);
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      tableName: 'advisor_supervisors',
      recordId: ADVISOR_ID,
      operation: 'U',
      userId: ADMIN_ID,
      oldData: { supervisorIds: ['old-supervisor'] },
      newData: { supervisorIds: [SUPERVISOR_ID, OTHER_SUPERVISOR_ID] },
      notes: 'Supervisors reassigned by admin',
      ...clientInfo,
    });
    const refreshCondition = refreshedCountBuilder.where.mock.calls[0]?.[0];
    expect(refreshedCountBuilder.from).toHaveBeenCalledWith(advisorSupervisors);
    expect(hasColumn(refreshCondition, advisorSupervisors.advisorId)).toBe(true);
    expect(hasValue(refreshCondition, ADVISOR_ID)).toBe(true);
    expect(refreshedRowsBuilder.where).toHaveBeenCalledWith(refreshCondition);
    expect(refreshedRowsBuilder.from).toHaveBeenCalledWith(advisorSupervisors);
    expect(refreshedRowsBuilder.limit).toHaveBeenCalledWith(100);
    expect(refreshedRowsBuilder.offset).toHaveBeenCalledWith(0);
    expect(
      isAscendingOrder(
        refreshedRowsBuilder.orderBy.mock.calls[0]?.[0],
        advisorSupervisors.assignedAt
      )
    ).toBe(true);
  });

  it('removes every target assignment when assigning an empty supervisor set', async () => {
    const existingEmployeesBuilder = directQuery([]);
    directQuery([{ supervisorId: SUPERVISOR_ID }]);
    const txDelete = { where: vi.fn().mockResolvedValue(undefined) };
    const txInsert = { values: vi.fn().mockResolvedValue(undefined) };
    const txDeleteCall = vi.fn(() => txDelete);
    const txInsertCall = vi.fn(() => txInsert);
    mockTransaction.mockImplementation(async (callback) =>
      callback({ delete: txDeleteCall, insert: txInsertCall })
    );
    countQuery([{ count: 0 }]);
    rowsQuery([]);
    await expect(
      service.assignSupervisors(ADMIN_ID, ADVISOR_ID, { supervisorIds: [] }, {})
    ).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
    });
    expect(existingEmployeesBuilder.from).toHaveBeenCalledWith(employees);
    const existingEmployeesCondition = existingEmployeesBuilder.where.mock.calls[0]?.[0];
    expect(hasColumn(existingEmployeesCondition, employees.userId)).toBe(false);
    expect(hasColumn(existingEmployeesCondition, employees.deletedAt)).toBe(true);
    expect(txDelete.where).toHaveBeenCalledTimes(1);
    expect(txDeleteCall).toHaveBeenCalledOnce();
    expect(txDeleteCall).toHaveBeenCalledWith(advisorSupervisors);
    expect(txInsertCall).toHaveBeenCalledOnce();
    expect(txInsertCall).toHaveBeenCalledWith(advisorSupervisors);
    expect(txInsert.values).toHaveBeenCalledWith([]);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        oldData: { supervisorIds: [SUPERVISOR_ID] },
        newData: { supervisorIds: [] },
      })
    );
  });
});
