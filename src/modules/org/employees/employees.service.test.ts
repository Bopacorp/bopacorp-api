import type { ListEmployeesQuery } from '@bopacorp/shared/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();

vi.mock('@lib/db.js', () => ({ db: { select: mockSelect } }));
vi.mock('@lib/audit.js', () => ({ createAuditLog: vi.fn() }));
vi.mock('../org-roles/org-roles.service.js', () => ({ getOrgRoleById: vi.fn() }));

const { listEmployees } = await import('./employees.service.js');

const query: ListEmployeesQuery = { page: 1, limit: 10, sortOrder: 'asc' };

function createCountQuery(total: number) {
  const chain = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockResolvedValue([{ count: total }]);
  return chain;
}

function createRowsQuery(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockResolvedValue(rows);
  return chain;
}

function createEmployeeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: '22222222-2222-2222-2222-222222222222',
    orgRoleId: '33333333-3333-3333-3333-333333333333',
    territory: null,
    hiredAt: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    userUsername: 'jdoe',
    userEmail: 'jdoe@example.com',
    userIsActive: true,
    userLockedUntil: new Date('2099-08-11T12:00:00.000Z'),
    profileFirstName: 'John',
    profileLastName: 'Doe',
    profileAvatarUrl: null,
    orgRoleCode: 'advisor',
    orgRoleName: 'Advisor',
    deptId: null,
    deptCode: null,
    deptName: null,
    ...overrides,
  };
}

describe('listEmployees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes a derived lock state when requested', async () => {
    mockSelect
      .mockReturnValueOnce(createCountQuery(1))
      .mockReturnValueOnce(createRowsQuery([createEmployeeRow()]));

    const result = await listEmployees({ ...query, includeLockStatus: true });

    expect(result.data[0]).toEqual(expect.objectContaining({ isLocked: true }));
  });

  it('omits lock state when not requested', async () => {
    mockSelect
      .mockReturnValueOnce(createCountQuery(1))
      .mockReturnValueOnce(createRowsQuery([createEmployeeRow()]));

    const result = await listEmployees(query);

    expect(result.data[0]).not.toHaveProperty('isLocked');
  });

  it('returns false for expired or inactive account locks', async () => {
    mockSelect.mockReturnValueOnce(createCountQuery(2)).mockReturnValueOnce(
      createRowsQuery([
        createEmployeeRow({ userLockedUntil: new Date('2026-01-01T00:00:00.000Z') }),
        createEmployeeRow({
          userId: '44444444-4444-4444-4444-444444444444',
          userIsActive: false,
        }),
      ])
    );

    const result = await listEmployees({ ...query, includeLockStatus: true });

    expect(result.data.map((employee) => employee.isLocked)).toEqual([false, false]);
  });
});
