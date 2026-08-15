import { BadRequestError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockUpload = vi.fn();
const mockDownload = vi.fn();
const mockRemove = vi.fn();

vi.mock('./candidate-resumes.service.js', () => ({
  listCandidateResumes: mockList,
  getCandidateResumeById: mockGet,
  uploadCandidateResume: mockUpload,
  downloadCandidateResume: mockDownload,
  removeCandidateResume: mockRemove,
}));

const controller = await import('./candidate-resumes.controller.js');

const ID = '11111111-1111-1111-1111-111111111111';

function request(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: { id: ID }, query: {}, ...overrides } as unknown as Request;
}

function response() {
  const res = {
    end: vi.fn(),
    headersSent: false,
    json: vi.fn(),
    on: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  vi.mocked(res.on).mockReturnValue(res);
  return res;
}

describe('candidate resumes controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards list, detail, upload, and remove operations', async () => {
    const query = { candidateId: ID };
    const body = { candidateId: ID };
    const file = {
      buffer: Buffer.from('%PDF-1.7'),
      originalname: 'resume.pdf',
      size: 9,
      mimetype: 'application/pdf',
    };
    const data = { id: ID, filename: 'resume.pdf' };
    const result = { data: [data], meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 } };
    mockList.mockResolvedValue(result);
    mockGet.mockResolvedValue(data);
    mockUpload.mockResolvedValue(data);

    const listRes = response();
    await controller.listCandidateResumes(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...result });

    const getRes = response();
    await controller.getCandidateResumeById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const uploadRes = response();
    await controller.uploadCandidateResume(request({ body, file }), uploadRes);
    expect(mockUpload).toHaveBeenCalledWith(
      body,
      file.buffer,
      file.originalname,
      file.size,
      file.mimetype
    );
    expect(uploadRes.status).toHaveBeenCalledWith(201);
    expect(uploadRes.json).toHaveBeenCalledWith({ success: true, data });

    const removeRes = response();
    await controller.removeCandidateResume(request(), removeRes);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('rejects uploads without a PDF file', async () => {
    await expect(controller.uploadCandidateResume(request(), response())).rejects.toThrow(
      BadRequestError
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('sets safe download headers and pipes the stored stream', async () => {
    const stream = { on: vi.fn(), destroy: vi.fn(), pipe: vi.fn() };
    stream.on.mockReturnValue(stream);
    const resume = { mimeType: 'application/pdf', filename: 'ada"\r\n.pdf' };
    mockDownload.mockResolvedValue({ stream, resume });
    const res = response();

    await controller.downloadCandidateResume(request(), res);

    expect(mockDownload).toHaveBeenCalledWith(ID);
    expect(res.setHeader).toHaveBeenNthCalledWith(1, 'Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      'attachment; filename="ada.pdf"'
    );
    expect(res.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(stream.pipe).toHaveBeenCalledWith(res);

    const responseErrorHandler = vi.mocked(res.on).mock.calls[0]?.[1] as (() => void) | undefined;
    responseErrorHandler?.();
    expect(stream.destroy).toHaveBeenCalled();
  });

  it('ends with a server error when the download stream fails before headers are sent', async () => {
    const stream = { on: vi.fn(), destroy: vi.fn(), pipe: vi.fn() };
    stream.on.mockReturnValue(stream);
    mockDownload.mockResolvedValue({
      stream,
      resume: { mimeType: 'application/pdf', filename: 'resume.pdf' },
    });
    const res = response();

    await controller.downloadCandidateResume(request(), res);

    const streamErrorHandler = vi
      .mocked(stream.on)
      .mock.calls.find((call) => call[0] === 'error')?.[1] as ((error: Error) => void) | undefined;
    expect(streamErrorHandler).toBeDefined();
    streamErrorHandler?.(new Error('stream failed'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.end).toHaveBeenCalled();
    expect(stream.destroy).toHaveBeenCalled();
  });
});
