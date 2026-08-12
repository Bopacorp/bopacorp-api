import { ForbiddenError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

const mockListEmployees = vi.fn();

vi.mock('./employees.service.js', () => ({ listEmployees: mockListEmployees }));

const { listEmployees } = await import('./employees.controller.js');

function createResponse() {
  return { json: vi.fn() } as unknown as Response;
}

describe('listEmployees controller', () => {
  it('rejects lock status requests without users.unlock', async () => {
    const req = {
      query: { includeLockStatus: true },
      user: { permissions: ['employees.read'] },
    } as unknown as Request;

    await expect(listEmployees(req, createResponse())).rejects.toThrow(ForbiddenError);
    expect(mockListEmployees).not.toHaveBeenCalled();
  });

  it('allows lock status requests with users.unlock', async () => {
    const req = {
      query: { includeLockStatus: true },
      user: { permissions: ['employees.read', 'users.unlock'] },
    } as unknown as Request;
    const res = createResponse();
    mockListEmployees.mockResolvedValue({ data: [], meta: { page: 1, limit: 10 } });

    await listEmployees(req, res);

    expect(mockListEmployees).toHaveBeenCalledWith(req.query);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [],
      meta: { page: 1, limit: 10 },
    });
  });
});
