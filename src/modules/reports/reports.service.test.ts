import type {
  CreateReportExportRequest,
  ListAdvisorMetricsQuery,
  ListAdvisorPerformanceQuery,
  ListRecentActivityQuery,
  ListReportExportsQuery,
  UpdateSalesTargetRequest,
} from '@bopacorp/shared/reports';
import { reportExports, salesTargets } from '@db/schema/reports.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCount,
  mockDelete,
  mockFindReportExport,
  mockFindRole,
  mockFindUser,
  mockFindUsers,
  mockInsert,
  mockSelect,
  mockScopedAdvisors,
  mockUpdate,
} = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockDelete: vi.fn(),
  mockFindReportExport: vi.fn(),
  mockFindRole: vi.fn(),
  mockFindUser: vi.fn(),
  mockFindUsers: vi.fn(),
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockScopedAdvisors: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    delete: mockDelete,
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    query: {
      reportExports: { findFirst: mockFindReportExport },
      roles: { findFirst: mockFindRole },
      users: { findFirst: mockFindUser, findMany: mockFindUsers },
    },
  },
}));
vi.mock('@shared/utils/scoping.js', () => ({
  getSupervisedAdvisorIds: mockScopedAdvisors,
}));

const service = await import('./reports.service.js');

const TARGET_ID = '11111111-1111-1111-1111-111111111111';
const SECOND_TARGET_ID = '22222222-2222-2222-2222-222222222222';
const ADVISOR_ID = '33333333-3333-3333-3333-333333333333';
const SECOND_ADVISOR_ID = '44444444-4444-4444-4444-444444444444';
const SUPERVISOR_ID = '55555555-5555-5555-5555-555555555555';
const MANAGER_ID = '66666666-6666-6666-6666-666666666666';
const ROLE_ID = '77777777-7777-7777-7777-777777777777';
const PROSPECTING_STATE_ID = '88888888-8888-8888-8888-888888888888';
const CLOSING_STATE_ID = '99999999-9999-9999-9999-999999999999';
const EXPORT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SECOND_EXPORT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const NOW = new Date('2026-08-15T12:00:00.000Z');

function target(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    createdBy: MANAGER_ID,
    tierCode: 'ONE_SHOT',
    tierLabel: 'One shot',
    minBilling: '1000.00',
    maxBilling: '5000.00',
    minCloses: 2,
    isActive: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    ...overrides,
  };
}

function advisorUser(id = ADVISOR_ID, overrides: Record<string, unknown> = {}) {
  return {
    id,
    username: id === ADVISOR_ID ? 'advisor' : 'second-advisor',
    email: `${id}@example.test`,
    profile: { firstName: 'Ada', lastName: 'Advisor' },
    ...overrides,
  };
}

function exportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXPORT_ID,
    generatedBy: MANAGER_ID,
    reportType: 'OPERATIONAL',
    title: 'Operational report',
    filename: 'operational.xlsx',
    fileExtension: 'xlsx',
    fileSizeMb: '2.50',
    storagePath: 'reports/operational.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    generatedAt: new Date('2026-08-10T10:00:00.000Z'),
    createdAt: new Date('2026-08-10T10:00:00.000Z'),
    ...overrides,
  };
}

function hydratedExport(overrides: Record<string, unknown> = {}) {
  return {
    ...exportRow(),
    generator: {
      id: MANAGER_ID,
      username: 'manager',
      email: 'manager@example.test',
    },
    ...overrides,
  };
}

function selectBuilder(
  result: unknown,
  terminal: 'where' | 'limit' | 'orderBy' | 'groupBy' | undefined = undefined
) {
  const builder = {
    as: vi.fn(),
    from: vi.fn(),
    groupBy: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
  };
  builder.as.mockReturnValue({ alias: 'subquery' });
  builder.from.mockReturnValue(builder);
  builder.groupBy.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);

  if (terminal) builder[terminal].mockResolvedValue(result);

  return builder;
}

function queueSelect(result: unknown, terminal: Parameters<typeof selectBuilder>[1]) {
  const builder = selectBuilder(result, terminal);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function updateBuilder() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return { set, where };
}

function insertBuilder(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return { values, returning };
}

describe('reports service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('lists active targets with numeric and nullable fields', async () => {
    const builder = queueSelect(
      [target(), target({ id: SECOND_TARGET_ID, tierCode: 'SMALL', maxBilling: null })],
      'orderBy'
    );

    await expect(service.listTargets()).resolves.toEqual({
      data: [
        {
          id: TARGET_ID,
          tierCode: 'ONE_SHOT',
          tierLabel: 'One shot',
          minBilling: 1000,
          maxBilling: 5000,
          minCloses: 2,
          isActive: true,
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-02T10:00:00.000Z',
        },
        expect.objectContaining({ id: SECOND_TARGET_ID, maxBilling: null }),
      ],
    });
    expect(builder.from).toHaveBeenCalledWith(salesTargets);
    expect(builder.orderBy).toHaveBeenCalledOnce();
  });

  it('updates every target field, converts billing values, and returns the refreshed target', async () => {
    const existingBuilder = queueSelect([target()], 'limit');
    const { set } = updateBuilder();
    queueSelect(
      [
        target({
          tierLabel: 'Updated tier',
          minBilling: '2000',
          maxBilling: null,
          minCloses: 4,
          isActive: false,
        }),
      ],
      'where'
    );
    const data: UpdateSalesTargetRequest = {
      tierLabel: 'Updated tier',
      minBilling: 2000,
      maxBilling: null,
      minCloses: 4,
      isActive: false,
    };

    await expect(service.updateTarget(TARGET_ID, data)).resolves.toEqual(
      expect.objectContaining({
        id: TARGET_ID,
        tierLabel: 'Updated tier',
        minBilling: 2000,
        maxBilling: null,
        minCloses: 4,
        isActive: false,
      })
    );
    expect(existingBuilder.limit).toHaveBeenCalledWith(1);
    expect(set).toHaveBeenCalledWith({
      tierLabel: 'Updated tier',
      minBilling: '2000',
      maxBilling: null,
      minCloses: 4,
      isActive: false,
      updatedAt: NOW,
    });
  });

  it('handles missing targets, empty updates, and missing refreshed rows', async () => {
    queueSelect([], 'limit');
    await expect(service.updateTarget(TARGET_ID, { tierLabel: 'Missing' })).rejects.toThrow(
      NotFoundError
    );

    vi.resetAllMocks();
    queueSelect([target()], 'limit');
    queueSelect([target()], 'where');
    await expect(service.updateTarget(TARGET_ID, {})).resolves.toEqual(
      expect.objectContaining({ id: TARGET_ID })
    );
    expect(mockUpdate).not.toHaveBeenCalled();

    vi.resetAllMocks();
    queueSelect([target()], 'limit');
    updateBuilder();
    queueSelect([], 'where');
    await expect(service.updateTarget(TARGET_ID, { isActive: false })).rejects.toThrow(
      NotFoundError
    );
  });

  it('returns empty advisor performance when prerequisites are absent', async () => {
    queueSelect([], 'orderBy');
    await expect(service.getAdvisorPerformance({})).resolves.toEqual({ data: [] });

    vi.resetAllMocks();
    queueSelect([target()], 'orderBy');
    mockFindRole.mockResolvedValueOnce(undefined);
    await expect(service.getAdvisorPerformance({})).resolves.toEqual({ data: [] });

    vi.resetAllMocks();
    queueSelect([target()], 'orderBy');
    mockFindRole.mockResolvedValueOnce({ id: ROLE_ID });
    queueSelect([], 'where');
    await expect(service.getAdvisorPerformance({})).resolves.toEqual({ data: [] });

    vi.resetAllMocks();
    queueSelect([target()], 'orderBy');
    mockFindRole.mockResolvedValueOnce({ id: ROLE_ID });
    queueSelect([{ userId: ADVISOR_ID }], 'where');
    queueSelect([], 'limit');
    await expect(service.getAdvisorPerformance({})).resolves.toEqual({ data: [] });
  });

  it('calculates advisor performance by tier, supervisor, and date range', async () => {
    const targets = [
      target({
        tierCode: 'ONE_SHOT',
        tierLabel: 'One shot',
        minBilling: '1000',
        maxBilling: '5000',
        minCloses: 2,
      }),
      target({
        id: SECOND_TARGET_ID,
        tierCode: 'MEDIANO',
        tierLabel: 'Medium',
        minBilling: '5001',
        maxBilling: null,
        minCloses: 1,
      }),
    ];
    queueSelect(targets, 'orderBy');
    mockFindRole.mockResolvedValueOnce({ id: ROLE_ID });
    mockScopedAdvisors.mockResolvedValueOnce([ADVISOR_ID]);
    queueSelect([{ userId: ADVISOR_ID }, { userId: SECOND_ADVISOR_ID }], 'where');
    queueSelect([{ id: CLOSING_STATE_ID }], 'limit');
    queueSelect(
      [
        { advisorId: ADVISOR_ID, tierCode: 'ONE_SHOT', count: 2 },
        { advisorId: ADVISOR_ID, tierCode: 'MEDIANO', count: 1 },
      ],
      'groupBy'
    );
    mockFindUsers.mockResolvedValueOnce([advisorUser()]);

    const query: ListAdvisorPerformanceQuery = {
      supervisorId: SUPERVISOR_ID,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-15',
    };
    await expect(service.getAdvisorPerformance(query)).resolves.toEqual({
      data: [
        {
          advisor: {
            id: ADVISOR_ID,
            username: 'advisor',
            email: `${ADVISOR_ID}@example.test`,
            profile: { firstName: 'Ada', lastName: 'Advisor' },
          },
          tiers: [
            {
              tierCode: 'ONE_SHOT',
              tierLabel: 'One shot',
              closedCount: 2,
              minCloses: 2,
              met: true,
            },
            { tierCode: 'MEDIANO', tierLabel: 'Medium', closedCount: 1, minCloses: 1, met: true },
          ],
          totalClosed: 3,
          totalRequired: 3,
          overallMet: true,
        },
      ],
    });
    expect(mockScopedAdvisors).toHaveBeenCalledWith(SUPERVISOR_ID);
    expect(mockFindUsers).toHaveBeenCalledOnce();
  });

  it('lists exports with filters, pagination, and generator fallbacks', async () => {
    const query: ListReportExportsQuery = {
      page: 2,
      limit: 5,
      reportType: 'OPERATIONAL',
      generatedBy: MANAGER_ID,
    };
    const builder = queueSelect([exportRow()], 'orderBy');
    mockCount.mockResolvedValueOnce(6);
    mockFindUser.mockResolvedValueOnce({ id: MANAGER_ID, username: 'manager' });

    await expect(service.listExports(query)).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: EXPORT_ID,
          reportType: 'OPERATIONAL',
          fileSizeMb: 2.5,
          createdBy: { id: MANAGER_ID, username: 'manager' },
        }),
      ],
      meta: { page: 2, limit: 5, totalItems: 6, totalPages: 2 },
    });
    expect(mockCount).toHaveBeenCalledWith(reportExports, expect.anything());
    expect(builder.limit).toHaveBeenCalledWith(5);
    expect(builder.offset).toHaveBeenCalledWith(5);

    vi.resetAllMocks();
    const fallbackBuilder = queueSelect([exportRow({ id: SECOND_EXPORT_ID })], 'orderBy');
    mockCount.mockResolvedValueOnce(1);
    mockFindUser.mockResolvedValueOnce(undefined);
    await expect(service.listExports({ page: 1, limit: 10 })).resolves.toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            id: SECOND_EXPORT_ID,
            createdBy: { id: MANAGER_ID, username: '' },
          }),
        ],
        meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
      })
    );
    expect(fallbackBuilder.where).toHaveBeenCalledOnce();
  });

  it('gets, creates, and rejects missing report exports', async () => {
    mockFindReportExport.mockResolvedValueOnce(hydratedExport()).mockResolvedValueOnce(undefined);
    await expect(service.getExportById(EXPORT_ID)).resolves.toEqual(
      expect.objectContaining({
        id: EXPORT_ID,
        fileSizeMb: 2.5,
        createdBy: {
          id: MANAGER_ID,
          username: 'manager',
          email: 'manager@example.test',
          profile: null,
        },
      })
    );
    await expect(service.getExportById(SECOND_EXPORT_ID)).rejects.toThrow(NotFoundError);

    const data: CreateReportExportRequest = {
      generatedBy: MANAGER_ID,
      reportType: 'COMMERCIAL_PERFORMANCE',
      title: 'Commercial report',
      filename: 'commercial.xlsx',
      fileExtension: 'xlsx',
      fileSizeMb: 1.25,
      storagePath: 'reports/commercial.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      generatedAt: '2026-08-14T10:00:00.000Z',
    };
    const values = insertBuilder([{ id: EXPORT_ID }]);
    mockFindReportExport.mockResolvedValueOnce(
      hydratedExport({ reportType: 'COMMERCIAL_PERFORMANCE' })
    );
    await expect(service.createExport(MANAGER_ID, data)).resolves.toEqual(
      expect.objectContaining({ reportType: 'COMMERCIAL_PERFORMANCE' })
    );
    expect(values.values).toHaveBeenCalledWith({
      generatedBy: MANAGER_ID,
      reportType: 'COMMERCIAL_PERFORMANCE',
      title: 'Commercial report',
      filename: 'commercial.xlsx',
      fileExtension: 'xlsx',
      fileSizeMb: '1.25',
      storagePath: 'reports/commercial.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      generatedAt: new Date('2026-08-14T10:00:00.000Z'),
    });

    vi.resetAllMocks();
    const defaultDateValues = insertBuilder([{ id: SECOND_EXPORT_ID }]);
    mockFindReportExport.mockResolvedValueOnce(hydratedExport({ id: SECOND_EXPORT_ID }));
    const withoutDate = { ...data, generatedAt: undefined };
    await service.createExport(MANAGER_ID, withoutDate);
    expect(defaultDateValues.values).toHaveBeenCalledWith(
      expect.objectContaining({ generatedAt: NOW })
    );

    vi.resetAllMocks();
    insertBuilder([]);
    await expect(service.createExport(MANAGER_ID, data)).rejects.toThrow(
      'Failed to create report export'
    );
  });

  it('returns empty advisor metrics when no advisors are available', async () => {
    mockFindRole.mockResolvedValueOnce(undefined);
    await expect(service.listAdvisorMetrics({})).resolves.toEqual({ data: [] });
  });

  it('builds advisor metrics from states, negotiations, visits, billing, and closing days', async () => {
    mockFindRole.mockResolvedValueOnce({ id: ROLE_ID });
    mockScopedAdvisors.mockResolvedValueOnce([ADVISOR_ID]);
    queueSelect([{ userId: ADVISOR_ID }], 'where');
    queueSelect(
      [
        { id: PROSPECTING_STATE_ID, code: 'prospecting', name: 'Prospecting', position: 1 },
        { id: CLOSING_STATE_ID, code: 'closing', name: 'Closing', position: 2 },
      ],
      'orderBy'
    );
    mockFindUsers.mockResolvedValueOnce([advisorUser()]);
    queueSelect([{ advisorId: ADVISOR_ID, stateId: PROSPECTING_STATE_ID, count: 2 }], 'groupBy');
    queueSelect([{ advisorId: ADVISOR_ID, count: 3 }], 'groupBy');
    queueSelect([{ advisorId: ADVISOR_ID, totalBilled: '1000', totalServices: '4' }], 'groupBy');
    queueSelect([{ advisorId: ADVISOR_ID, avgDays: '2.5' }], 'groupBy');

    const query: ListAdvisorMetricsQuery = {
      advisorId: ADVISOR_ID,
      supervisorId: SUPERVISOR_ID,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-15',
    };
    await expect(service.listAdvisorMetrics(query)).resolves.toEqual({
      data: [
        {
          advisor: {
            id: ADVISOR_ID,
            username: 'advisor',
            profile: { firstName: 'Ada', lastName: 'Advisor' },
          },
          stateCounts: [
            {
              stateId: PROSPECTING_STATE_ID,
              stateCode: 'prospecting',
              stateName: 'Prospecting',
              count: 2,
            },
            { stateId: CLOSING_STATE_ID, stateCode: 'closing', stateName: 'Closing', count: 0 },
          ],
          clientsVisited: 3,
          totalBilledAmount: 1000,
          averageBillingPerService: 250,
          avgDaysToClose: 2.5,
        },
      ],
    });
    expect(mockScopedAdvisors).toHaveBeenCalledWith(SUPERVISOR_ID);
  });

  it('handles missing metric users, zero-service billing, and no closing state', async () => {
    mockFindRole.mockResolvedValueOnce({ id: ROLE_ID });
    queueSelect([{ userId: ADVISOR_ID }], 'where');
    queueSelect(
      [{ id: PROSPECTING_STATE_ID, code: 'prospecting', name: 'Prospecting', position: 1 }],
      'orderBy'
    );
    mockFindUsers.mockResolvedValueOnce([]);
    queueSelect([], 'groupBy');
    queueSelect([], 'groupBy');
    queueSelect([{ advisorId: ADVISOR_ID, totalBilled: '500', totalServices: '0' }], 'groupBy');

    await expect(service.listAdvisorMetrics({})).resolves.toEqual({ data: [] });
  });

  it('merges, sorts, filters, and paginates recent state changes and visits', async () => {
    const previousState = selectBuilder(undefined);
    const newState = selectBuilder(undefined);
    const stateChanges = queueSelect(
      [
        {
          advisorFirstName: 'Ada',
          advisorLastName: 'Advisor',
          clientName: 'Acme',
          prevStateName: 'Prospecting',
          newStateName: 'Closing',
          createdAt: new Date('2026-08-15T11:00:00.000Z'),
        },
        {
          advisorFirstName: 'Grace',
          advisorLastName: 'Engineer',
          clientName: 'Beta',
          prevStateName: null,
          newStateName: 'Prospecting',
          createdAt: new Date('2026-08-14T11:00:00.000Z'),
        },
      ],
      'limit'
    );
    const visits = queueSelect(
      [
        {
          advisorFirstName: 'Linus',
          advisorLastName: 'Coder',
          clientName: 'Gamma',
          createdAt: new Date('2026-08-15T10:00:00.000Z'),
        },
      ],
      'limit'
    );
    mockSelect.mockReset();
    mockSelect
      .mockReturnValueOnce(previousState)
      .mockReturnValueOnce(newState)
      .mockReturnValueOnce(stateChanges)
      .mockReturnValueOnce(visits);

    const query: ListRecentActivityQuery = {
      page: 1,
      limit: 2,
      advisorId: ADVISOR_ID,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-15',
    };
    await expect(service.listRecentActivity(query)).resolves.toEqual({
      data: [
        {
          type: 'state_change',
          advisorName: 'Ada Advisor',
          clientName: 'Acme',
          description: 'Prospecting -> Closing',
          createdAt: '2026-08-15T11:00:00.000Z',
        },
        {
          type: 'visit',
          advisorName: 'Linus Coder',
          clientName: 'Gamma',
          description: 'Visited client',
          createdAt: '2026-08-15T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(stateChanges.limit).toHaveBeenCalledWith(4);
    expect(visits.limit).toHaveBeenCalledWith(4);
    expect(previousState.as).toHaveBeenCalledWith('prev_state');
    expect(newState.as).toHaveBeenCalledWith('new_state');
  });

  it('returns empty recent activity with zero pagination totals', async () => {
    const previousState = selectBuilder(undefined);
    const newState = selectBuilder(undefined);
    const stateChanges = selectBuilder([], 'limit');
    const visits = selectBuilder([], 'limit');
    mockSelect
      .mockReturnValueOnce(previousState)
      .mockReturnValueOnce(newState)
      .mockReturnValueOnce(stateChanges)
      .mockReturnValueOnce(visits);

    await expect(service.listRecentActivity({ page: 1, limit: 10 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
  });
});
