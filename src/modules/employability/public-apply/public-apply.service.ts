import crypto from 'node:crypto';
import type { ApplyJobVacancyRequest } from '@bopacorp/shared/employability';
import {
  candidateResumes,
  candidates,
  jobApplications,
  jobVacancies,
} from '@db/schema/employability.js';
import { db } from '@lib/db.js';
import { deleteFile, uploadFile } from '@lib/storage.js';
import { InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, isNull } from 'drizzle-orm';

export async function applyJobVacancy(
  data: ApplyJobVacancyRequest,
  fileBuffer: Buffer,
  originalName: string,
  fileSizeBytes: number,
  mimeType: string
) {
  const vacancy = await db.query.jobVacancies.findFirst({
    where: and(
      eq(jobVacancies.id, data.vacancyId),
      eq(jobVacancies.isPublished, true),
      eq(jobVacancies.isActive, true),
      isNull(jobVacancies.deletedAt)
    ),
  });

  if (!vacancy) {
    throw new NotFoundError('Job vacancy', data.vacancyId);
  }

  const normalizedEmail = data.candidate.email.toLowerCase();

  const existing = await db.query.candidates.findFirst({
    where: eq(candidates.nationalId, data.candidate.nationalId),
  });

  let candidateId: string;

  if (existing) {
    candidateId = existing.id;
  } else {
    const [created] = await db
      .insert(candidates)
      .values({
        nationalId: data.candidate.nationalId,
        firstName: data.candidate.firstName,
        lastName: data.candidate.lastName,
        email: normalizedEmail,
        phone: data.candidate.phone,
        address: data.candidate.address,
      })
      .returning();

    if (!created) {
      throw new InternalServerError('Failed to create candidate');
    }
    candidateId = created.id;
  }

  const fileExtension = originalName.split('.').pop() ?? 'pdf';
  const filename = `${crypto.randomUUID()}.${fileExtension}`;
  const storagePath = `candidates/${candidateId}/${filename}`;

  await uploadFile(storagePath, fileBuffer, mimeType);

  const fileSizeMb = fileSizeBytes / (1024 * 1024);

  try {
    const result = await db.transaction(async (tx) => {
      await tx
        .update(candidates)
        .set({
          firstName: data.candidate.firstName,
          lastName: data.candidate.lastName,
          email: normalizedEmail,
          phone: data.candidate.phone,
          address: data.candidate.address,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, candidateId));

      const [resume] = await tx
        .insert(candidateResumes)
        .values({
          candidateId,
          filename: originalName,
          fileExtension,
          fileSizeMb: fileSizeMb.toFixed(2),
          storagePath,
          mimeType,
        })
        .returning();

      if (!resume) {
        throw new InternalServerError('Failed to save resume metadata');
      }

      const [application] = await tx
        .insert(jobApplications)
        .values({
          vacancyId: data.vacancyId,
          candidateId,
          state: 'PENDING',
          coverLetter: data.coverLetter,
          appliedAt: new Date(),
        })
        .returning();

      if (!application) {
        throw new InternalServerError('Failed to create job application');
      }

      await tx
        .update(candidateResumes)
        .set({ applicationId: application.id })
        .where(eq(candidateResumes.id, resume.id));

      return { application, resume };
    });

    return {
      id: result.application.id,
      state: result.application.state,
      appliedAt: result.application.appliedAt ? result.application.appliedAt.toISOString() : '',
      candidate: {
        id: candidateId,
        firstName: data.candidate.firstName,
        lastName: data.candidate.lastName,
        email: normalizedEmail,
      },
      vacancy: {
        id: vacancy.id,
        title: vacancy.title,
      },
    };
  } catch (error) {
    await deleteFile(storagePath);
    throw error;
  }
}
