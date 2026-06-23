import type {
  CreateJobApplicationRequest,
  ListJobApplicationsQuery,
  UpdateJobApplicationRequest,
} from '@bopacorp/shared/employability';
import {
  candidateResumes,
  candidates,
  jobApplications,
  jobVacancies,
} from '@db/schema/employability.js';
import { db } from '@lib/db.js';
import { InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';

async function findResumeForApplication(applicationId: string, candidateId: string) {
  const resume = await db.query.candidateResumes.findFirst({
    where: and(
      eq(candidateResumes.candidateId, candidateId),
      or(eq(candidateResumes.applicationId, applicationId), isNull(candidateResumes.applicationId))
    ),
    orderBy: (t, { desc: descFn }) => descFn(t.uploadedAt),
  });

  if (!resume) return null;

  return {
    id: resume.id,
    filename: resume.filename,
    mimeType: resume.mimeType,
    fileSizeMb: Number.parseFloat(resume.fileSizeMb),
  };
}

export async function listJobApplications(query: ListJobApplicationsQuery) {
  const conditions = [isNull(jobApplications.deletedAt)];

  if (query.vacancyId) {
    conditions.push(eq(jobApplications.vacancyId, query.vacancyId));
  }

  if (query.candidateId) {
    conditions.push(eq(jobApplications.candidateId, query.candidateId));
  }

  if (query.state) {
    conditions.push(eq(jobApplications.state, query.state));
  }

  if (query.reviewedBy) {
    conditions.push(eq(jobApplications.reviewedBy, query.reviewedBy));
  }

  const where = and(...conditions);

  const totalItems = await db.$count(jobApplications, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: jobApplications.id,
      state: jobApplications.state,
      appliedAt: jobApplications.appliedAt,
      createdAt: jobApplications.createdAt,
      updatedAt: jobApplications.updatedAt,
      vacancy: { id: jobVacancies.id, title: jobVacancies.title },
      candidate: {
        id: candidates.id,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
      },
    })
    .from(jobApplications)
    .innerJoin(jobVacancies, eq(jobApplications.vacancyId, jobVacancies.id))
    .innerJoin(candidates, eq(jobApplications.candidateId, candidates.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(jobApplications.createdAt);

  const applicationIds = rows.map((row) => row.id);
  const candidateIds = rows.map((row) => row.candidate.id);

  const resumes = applicationIds.length
    ? await db
        .select()
        .from(candidateResumes)
        .where(
          and(
            or(
              inArray(candidateResumes.applicationId, applicationIds),
              and(
                isNull(candidateResumes.applicationId),
                inArray(candidateResumes.candidateId, candidateIds)
              )
            )
          )
        )
        .orderBy(desc(candidateResumes.uploadedAt))
    : [];

  const data = rows.map((row) => {
    const applicationResume = resumes.find((resume) => resume.applicationId === row.id);
    const fallbackResume = resumes.find(
      (resume) =>
        !resume.applicationId &&
        resume.candidateId === row.candidate.id &&
        resume.id !== applicationResume?.id
    );
    const resume = applicationResume ?? fallbackResume ?? null;

    return {
      ...row,
      hasResume: !!resume,
      appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
    };
  });

  return {
    data,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getJobApplicationById(id: string) {
  const application = await db.query.jobApplications.findFirst({
    where: and(eq(jobApplications.id, id), isNull(jobApplications.deletedAt)),
    with: { vacancy: true, candidate: true, reviewer: true },
  });

  if (!application) {
    throw new NotFoundError('Job application', id);
  }

  const vacancy = application.vacancy;
  const candidate = application.candidate;
  const reviewer = application.reviewer;
  const resume = await findResumeForApplication(application.id, candidate?.id ?? '');

  return {
    id: application.id,
    state: application.state,
    coverLetter: application.coverLetter,
    reviewNotes: application.reviewNotes,
    reviewDate: application.reviewDate ? application.reviewDate.toISOString() : null,
    appliedAt: application.appliedAt ? application.appliedAt.toISOString() : null,
    vacancy: vacancy ? { id: vacancy.id, title: vacancy.title } : { id: '', title: '' },
    candidate: candidate
      ? {
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
        }
      : { id: '', firstName: '', lastName: '', email: '' },
    reviewer: reviewer
      ? { id: reviewer.id, username: reviewer.username, email: reviewer.email }
      : null,
    resume,
    createdAt: application.createdAt ? application.createdAt.toISOString() : '',
    updatedAt: application.updatedAt ? application.updatedAt.toISOString() : '',
  };
}

export async function createJobApplication(data: CreateJobApplicationRequest) {
  const vacancy = await db.query.jobVacancies.findFirst({
    where: and(eq(jobVacancies.id, data.vacancyId), isNull(jobVacancies.deletedAt)),
  });

  if (!vacancy) {
    throw new NotFoundError('Job vacancy', data.vacancyId);
  }

  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, data.candidateId),
  });

  if (!candidate) {
    throw new NotFoundError('Candidate', data.candidateId);
  }

  const [application] = await db
    .insert(jobApplications)
    .values({
      vacancyId: data.vacancyId,
      candidateId: data.candidateId,
      coverLetter: data.coverLetter,
    })
    .returning();

  if (!application) {
    throw new InternalServerError('Failed to create job application');
  }

  return getJobApplicationById(application.id);
}

export async function updateJobApplication(
  id: string,
  userId: string,
  data: UpdateJobApplicationRequest
) {
  const application = await db.query.jobApplications.findFirst({
    where: and(eq(jobApplications.id, id), isNull(jobApplications.deletedAt)),
  });

  if (!application) {
    throw new NotFoundError('Job application', id);
  }

  const updateData: Partial<typeof jobApplications.$inferInsert> = {
    updatedAt: new Date(),
  };

  let shouldSetReview = false;

  if (data.state !== undefined) {
    updateData.state = data.state;
    if (application.state === 'DRAFT' && data.state !== 'DRAFT' && !application.appliedAt) {
      updateData.appliedAt = new Date();
    }
    shouldSetReview = true;
  }

  if (data.reviewNotes !== undefined) {
    updateData.reviewNotes = data.reviewNotes;
    shouldSetReview = true;
  }

  if (shouldSetReview) {
    updateData.reviewedBy = userId;
    updateData.reviewDate = new Date();
  }

  await db.update(jobApplications).set(updateData).where(eq(jobApplications.id, id));

  return getJobApplicationById(id);
}

export async function removeJobApplication(id: string) {
  const application = await db.query.jobApplications.findFirst({
    where: and(eq(jobApplications.id, id), isNull(jobApplications.deletedAt)),
  });

  if (!application) {
    throw new NotFoundError('Job application', id);
  }

  await db.update(jobApplications).set({ deletedAt: new Date() }).where(eq(jobApplications.id, id));
}
