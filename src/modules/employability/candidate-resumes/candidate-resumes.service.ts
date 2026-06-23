import crypto from 'node:crypto';
import type {
  ListCandidateResumesQuery,
  UploadCandidateResumeRequest,
} from '@bopacorp/shared/employability';
import { candidateResumes, candidates, jobApplications } from '@db/schema/employability.js';
import { db } from '@lib/db.js';
import { deleteFile, downloadFile, uploadFile } from '@lib/storage.js';
import { InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, isNull } from 'drizzle-orm';

export async function listCandidateResumes(query: ListCandidateResumesQuery) {
  const conditions = [];

  if (query.candidateId) {
    conditions.push(eq(candidateResumes.candidateId, query.candidateId));
  }

  if (query.applicationId) {
    conditions.push(eq(candidateResumes.applicationId, query.applicationId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalItems = await db.$count(candidateResumes, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(candidateResumes)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(candidateResumes.createdAt);

  return {
    data: rows.map((row) => ({
      id: row.id,
      candidateId: row.candidateId,
      applicationId: row.applicationId,
      filename: row.filename,
      fileExtension: row.fileExtension,
      fileSizeMb: Number.parseFloat(row.fileSizeMb),
      storagePath: row.storagePath,
      mimeType: row.mimeType,
      uploadedAt: row.uploadedAt ? row.uploadedAt.toISOString() : '',
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getCandidateResumeById(id: string) {
  const resume = await db.query.candidateResumes.findFirst({
    where: eq(candidateResumes.id, id),
  });

  if (!resume) {
    throw new NotFoundError('Candidate resume', id);
  }

  return {
    id: resume.id,
    candidateId: resume.candidateId,
    applicationId: resume.applicationId,
    filename: resume.filename,
    fileExtension: resume.fileExtension,
    fileSizeMb: Number.parseFloat(resume.fileSizeMb),
    storagePath: resume.storagePath,
    mimeType: resume.mimeType,
    uploadedAt: resume.uploadedAt ? resume.uploadedAt.toISOString() : '',
    createdAt: resume.createdAt ? resume.createdAt.toISOString() : '',
  };
}

export async function uploadCandidateResume(
  data: UploadCandidateResumeRequest,
  fileBuffer: Buffer,
  originalName: string,
  fileSizeBytes: number,
  mimeType: string
) {
  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, data.candidateId),
  });

  if (!candidate) {
    throw new NotFoundError('Candidate', data.candidateId);
  }

  if (data.applicationId) {
    const application = await db.query.jobApplications.findFirst({
      where: and(eq(jobApplications.id, data.applicationId), isNull(jobApplications.deletedAt)),
    });
    if (!application) {
      throw new NotFoundError('Job application', data.applicationId);
    }
  }

  const fileExtension = originalName.split('.').pop() ?? 'pdf';
  const filename = `${crypto.randomUUID()}.${fileExtension}`;
  const storagePath = `candidates/${data.candidateId}/${filename}`;

  await uploadFile(storagePath, fileBuffer, mimeType);

  const fileSizeMb = fileSizeBytes / (1024 * 1024);
  const [resume] = await db
    .insert(candidateResumes)
    .values({
      candidateId: data.candidateId,
      applicationId: data.applicationId,
      filename: originalName,
      fileExtension,
      fileSizeMb: fileSizeMb.toFixed(2),
      storagePath,
      mimeType,
    })
    .returning();

  if (!resume) {
    await deleteFile(storagePath);
    throw new InternalServerError('Failed to save resume metadata');
  }

  return getCandidateResumeById(resume.id);
}

export async function downloadCandidateResume(id: string) {
  const resume = await getCandidateResumeById(id);
  const stream = await downloadFile(resume.storagePath);

  if (!stream) {
    throw new NotFoundError('Resume file', id);
  }

  return { stream, resume };
}

export async function removeCandidateResume(id: string) {
  const resume = await db.query.candidateResumes.findFirst({
    where: eq(candidateResumes.id, id),
  });

  if (!resume) {
    throw new NotFoundError('Candidate resume', id);
  }

  await deleteFile(resume.storagePath);
  await db.delete(candidateResumes).where(eq(candidateResumes.id, id));
}
