import { BadRequestError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApplyJobVacancy = vi.fn();

vi.mock('./public-apply.service.js', () => ({ applyJobVacancy: mockApplyJobVacancy }));

const { applyJobVacancy } = await import('./public-apply.controller.js');

const VACANCY_ID = '11111111-1111-1111-1111-111111111111';

function createResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status } as unknown as Response;
}

describe('applyJobVacancy controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an application without the required PDF file', async () => {
    const req = {
      body: { vacancyId: VACANCY_ID },
    } as unknown as Request;

    await expect(applyJobVacancy(req, createResponse())).rejects.toThrow(BadRequestError);
    expect(mockApplyJobVacancy).not.toHaveBeenCalled();
  });

  it('passes a validated PDF application to the service and returns the created response', async () => {
    const fileBuffer = Buffer.from('%PDF-1.7');
    const requestBody = {
      vacancyId: VACANCY_ID,
      candidate: {
        nationalId: '0912345678',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '0999999999',
      },
    };
    const responseData = { id: '22222222-2222-2222-2222-222222222222', state: 'PENDING' };
    const req = {
      body: requestBody,
      file: {
        buffer: fileBuffer,
        originalname: 'ada-lovelace.pdf',
        size: fileBuffer.length,
        mimetype: 'application/pdf',
      },
    } as unknown as Request;
    const res = createResponse();
    mockApplyJobVacancy.mockResolvedValue(responseData);

    await applyJobVacancy(req, res);

    expect(mockApplyJobVacancy).toHaveBeenCalledWith(
      requestBody,
      fileBuffer,
      'ada-lovelace.pdf',
      fileBuffer.length,
      'application/pdf'
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: responseData });
  });
});
