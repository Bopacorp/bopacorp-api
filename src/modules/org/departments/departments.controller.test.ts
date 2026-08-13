import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListDepartments = vi.fn();
const mockGetDepartmentById = vi.fn();
const mockCreateDepartment = vi.fn();
const mockUpdateDepartment = vi.fn();
const mockDisableDepartment = vi.fn();

vi.mock('./departments.service.js', () => ({
  listDepartments: mockListDepartments,
  getDepartmentById: mockGetDepartmentById,
  createDepartment: mockCreateDepartment,
  updateDepartment: mockUpdateDepartment,
  disableDepartment: mockDisableDepartment,
}));

const controller = await import('./departments.controller.js');

const DEPARTMENT_ID = '11111111-1111-1111-1111-111111111111';

function createRequest(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: { id: DEPARTMENT_ID }, query: {}, ...overrides } as unknown as Request;
}

function createResponse() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('departments controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards list query and returns the success envelope', async () => {
    const query = { search: 'adv', isActive: true };
    const data = [{ id: DEPARTMENT_ID, code: 'ADV' }];
    const res = createResponse();
    mockListDepartments.mockResolvedValue(data);

    await controller.listDepartments(createRequest({ query }), res);
    expect(mockListDepartments).toHaveBeenCalledWith(query);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('forwards the id and returns a detail success envelope', async () => {
    const data = { id: DEPARTMENT_ID, code: 'ADV' };
    const res = createResponse();
    mockGetDepartmentById.mockResolvedValue(data);

    await controller.getDepartmentById(createRequest(), res);
    expect(mockGetDepartmentById).toHaveBeenCalledWith(DEPARTMENT_ID);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('creates with a 201 response and forwards the body unchanged', async () => {
    const body = { code: 'ADV', name: 'Advising' };
    const data = { id: DEPARTMENT_ID, ...body };
    const res = createResponse();
    mockCreateDepartment.mockResolvedValue(data);

    await controller.createDepartment(createRequest({ body }), res);
    expect(mockCreateDepartment).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('updates with the exact id and body and returns a success envelope', async () => {
    const body = { name: 'Student Services', isActive: false };
    const data = { id: DEPARTMENT_ID, code: 'STU', ...body };
    const res = createResponse();
    mockUpdateDepartment.mockResolvedValue(data);

    await controller.updateDepartment(createRequest({ body }), res);
    expect(mockUpdateDepartment).toHaveBeenCalledWith(DEPARTMENT_ID, body);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('disables the requested department and returns null data', async () => {
    const res = createResponse();
    mockDisableDepartment.mockResolvedValue(undefined);

    await controller.disableDepartment(createRequest(), res);
    expect(mockDisableDepartment).toHaveBeenCalledWith(DEPARTMENT_ID);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('propagates service errors without writing an alternate response', async () => {
    const error = new Error('Department unavailable');
    const res = createResponse();
    mockGetDepartmentById.mockRejectedValue(error);

    await expect(controller.getDepartmentById(createRequest(), res)).rejects.toBe(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
