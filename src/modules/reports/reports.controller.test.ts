import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListTargets = vi.fn();
const mockUpdateTarget = vi.fn();
const mockGetAdvisorPerformance = vi.fn();
const mockListExports = vi.fn();
const mockGetExportById = vi.fn();
const mockCreateExport = vi.fn();
const mockListAdvisorMetrics = vi.fn();
const mockListRecentActivity = vi.fn();

vi.mock('./reports.service.js', () => ({
  listTargets: mockListTargets,
  updateTarget: mockUpdateTarget,
  getAdvisorPerformance: mockGetAdvisorPerformance,
  listExports: mockListExports,
  getExportById: mockGetExportById,
  createExport: mockCreateExport,
  listAdvisorMetrics: mockListAdvisorMetrics,
  listRecentActivity: mockListRecentActivity,
}));

const controller = await import('./reports.controller.js');

const TARGET_ID = '11111111-1111-1111-1111-111111111111';
const EXPORT_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';

function request(overrides: Record<string, unknown> = {}) {
  return {
    params: { id: TARGET_ID },
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function response() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('reports controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards target and export operations with their response envelopes', async () => {
    const target = { id: TARGET_ID, tierLabel: 'Updated' };
    const exportData = { id: EXPORT_ID, filename: 'report.xlsx' };
    mockListTargets.mockResolvedValueOnce({ data: [target] });
    mockUpdateTarget.mockResolvedValueOnce(target);
    mockListExports.mockResolvedValueOnce({
      data: [exportData],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    mockGetExportById.mockResolvedValueOnce(exportData);
    mockCreateExport.mockResolvedValueOnce(exportData);

    const listTargetsRes = response();
    await controller.listTargets(request(), listTargetsRes);
    expect(mockListTargets).toHaveBeenCalledWith();
    expect(listTargetsRes.json).toHaveBeenCalledWith({ success: true, data: [target] });

    const updateRes = response();
    await controller.updateTarget(request({ body: { tierLabel: 'Updated' } }), updateRes);
    expect(mockUpdateTarget).toHaveBeenCalledWith(TARGET_ID, { tierLabel: 'Updated' });
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data: target });

    const listExportsRes = response();
    const query = { page: 1, limit: 10 };
    await controller.listExports(request({ query }), listExportsRes);
    expect(mockListExports).toHaveBeenCalledWith(query);
    expect(listExportsRes.json).toHaveBeenCalledWith({
      success: true,
      data: [exportData],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });

    const getExportRes = response();
    await controller.getExportById(request({ params: { id: EXPORT_ID } }), getExportRes);
    expect(mockGetExportById).toHaveBeenCalledWith(EXPORT_ID);
    expect(getExportRes.json).toHaveBeenCalledWith({ success: true, data: exportData });

    const createRes = response();
    const body = { title: 'New export' };
    await controller.createExport(request({ body, user: { id: USER_ID } }), createRes);
    expect(mockCreateExport).toHaveBeenCalledWith(USER_ID, body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data: exportData });
  });

  it('requires authentication for export creation', async () => {
    await expect(controller.createExport(request({ body: {} }), response())).rejects.toThrow(
      UnauthorizedError
    );
    expect(mockCreateExport).not.toHaveBeenCalled();
  });

  it('handles advisor performance for management and non-management users', async () => {
    const query = { supervisorId: USER_ID };
    mockGetAdvisorPerformance.mockResolvedValueOnce({ data: [{ advisor: { id: USER_ID } }] });
    const managementRes = response();
    await controller.getAdvisorPerformance(
      request({ query, user: { id: USER_ID, roles: ['manager'] } }),
      managementRes
    );
    expect(mockGetAdvisorPerformance).toHaveBeenCalledWith(query);
    expect(managementRes.json).toHaveBeenCalledWith({
      success: true,
      data: [{ advisor: { id: USER_ID } }],
    });

    const nonManagementRes = response();
    await controller.getAdvisorPerformance(
      request({ query: { supervisorId: USER_ID }, user: { id: USER_ID, roles: ['advisor'] } }),
      nonManagementRes
    );
    expect(nonManagementRes.json).toHaveBeenCalledWith({ success: true, data: [] });
    expect(mockGetAdvisorPerformance).toHaveBeenCalledOnce();

    await expect(controller.getAdvisorPerformance(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
  });

  it('forces advisor metrics to the current user and preserves management queries', async () => {
    mockListAdvisorMetrics.mockResolvedValue({ data: [{ advisor: { id: USER_ID } }] });
    const advisorQuery = { dateFrom: '2026-08-01' };
    const advisorRes = response();
    await controller.listAdvisorMetrics(
      request({ query: advisorQuery, user: { id: USER_ID, roles: ['advisor'] } }),
      advisorRes
    );
    expect(mockListAdvisorMetrics).toHaveBeenCalledWith({
      dateFrom: '2026-08-01',
      advisorId: USER_ID,
    });
    expect(advisorRes.json).toHaveBeenCalledWith({
      success: true,
      data: [{ advisor: { id: USER_ID } }],
    });

    const managementQuery = { supervisorId: USER_ID };
    const managerRes = response();
    await controller.listAdvisorMetrics(
      request({ query: managementQuery, user: { id: USER_ID, roles: ['admin'] } }),
      managerRes
    );
    expect(mockListAdvisorMetrics).toHaveBeenCalledWith(managementQuery);

    await expect(controller.listAdvisorMetrics(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
  });

  it('forwards recent activity with pagination metadata', async () => {
    const query = { page: 2, limit: 5 };
    const result = {
      data: [{ type: 'visit', clientName: 'Acme' }],
      meta: { page: 2, limit: 5, totalItems: 6, totalPages: 2 },
    };
    mockListRecentActivity.mockResolvedValueOnce(result);
    const res = response();

    await controller.listRecentActivity(request({ query }), res);

    expect(mockListRecentActivity).toHaveBeenCalledWith(query);
    expect(res.json).toHaveBeenCalledWith({ success: true, ...result });
  });

  it('propagates service failures without writing responses', async () => {
    const error = new Error('report failed');
    mockListTargets.mockRejectedValueOnce(error);
    const res = response();

    await expect(controller.listTargets(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
