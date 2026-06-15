import crypto from 'node:crypto';
import type {
  ApplyJobVacancyRequest,
  CreateCandidateRequest,
  CreateJobApplicationRequest,
  CreateJobVacancyRequest,
  ListCandidateResumesQuery,
  ListCandidatesQuery,
  ListJobApplicationsQuery,
  ListJobVacanciesQuery,
  PublicJobVacancyResponse,
  UpdateCandidateRequest,
  UpdateJobApplicationRequest,
  UpdateJobVacancyRequest,
  UploadCandidateResumeRequest,
} from '@bopacorp/shared/employability';
import { users } from '@db/schema/auth.js';
import {
  candidateResumes,
  candidates,
  jobApplications,
  jobVacancies,
} from '@db/schema/employability.js';
import { db } from '@lib/db.js';
import { deleteFile, downloadFile, uploadFile } from '@lib/storage.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, desc, eq, gte, ilike, inArray, isNull, or } from 'drizzle-orm';

// --- Vacancies ---

export async function listVacancies(query: ListJobVacanciesQuery) {
  const conditions = [isNull(jobVacancies.deletedAt)];

  if (query.isActive !== undefined) {
    conditions.push(eq(jobVacancies.isActive, query.isActive));
  }

  if (query.isPublished !== undefined) {
    conditions.push(eq(jobVacancies.isPublished, query.isPublished));
  }

  if (query.search) {
    conditions.push(ilike(jobVacancies.title, `%${query.search}%`));
  }

  const where = and(...conditions);

  const totalItems = await db.$count(jobVacancies, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: jobVacancies.id,
      title: jobVacancies.title,
      isActive: jobVacancies.isActive,
      isPublished: jobVacancies.isPublished,
      publicationDate: jobVacancies.publicationDate,
      closingDate: jobVacancies.closingDate,
      createdAt: jobVacancies.createdAt,
      updatedAt: jobVacancies.updatedAt,
      creator: { id: users.id, username: users.username },
    })
    .from(jobVacancies)
    .innerJoin(users, eq(jobVacancies.createdBy, users.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(jobVacancies.createdAt);

  return {
    data: rows.map((row) => ({
      ...row,
      publicationDate: row.publicationDate ? row.publicationDate.toISOString() : null,
      closingDate: row.closingDate ? row.closingDate.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getVacancyById(id: string) {
  const vacancy = await db.query.jobVacancies.findFirst({
    where: and(eq(jobVacancies.id, id), isNull(jobVacancies.deletedAt)),
    with: { creator: true },
  });

  if (!vacancy) {
    throw new NotFoundError('Job vacancy', id);
  }

  const creator = vacancy.creator;

  return {
    id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    requirements: vacancy.requirements,
    isActive: vacancy.isActive,
    isPublished: vacancy.isPublished,
    publicationDate: vacancy.publicationDate ? vacancy.publicationDate.toISOString() : null,
    closingDate: vacancy.closingDate ? vacancy.closingDate.toISOString() : null,
    creator: creator
      ? { id: creator.id, username: creator.username, email: creator.email }
      : { id: '', username: '', email: '' },
    createdAt: vacancy.createdAt ? vacancy.createdAt.toISOString() : '',
    updatedAt: vacancy.updatedAt ? vacancy.updatedAt.toISOString() : '',
  };
}

export async function createVacancy(userId: string, data: CreateJobVacancyRequest) {
  const [vacancy] = await db
    .insert(jobVacancies)
    .values({
      createdBy: userId,
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      isActive: data.isActive,
      isPublished: data.isPublished,
      publicationDate: data.publicationDate ? new Date(data.publicationDate) : undefined,
      closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
    })
    .returning();

  if (!vacancy) {
    throw new InternalServerError('Failed to create job vacancy');
  }

  return getVacancyById(vacancy.id);
}

export async function updateVacancy(id: string, data: UpdateJobVacancyRequest) {
  await getVacancyById(id);

  const updateData: Partial<typeof jobVacancies.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.requirements !== undefined) updateData.requirements = data.requirements;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;
  if (data.publicationDate !== undefined)
    updateData.publicationDate = data.publicationDate ? new Date(data.publicationDate) : null;
  if (data.closingDate !== undefined)
    updateData.closingDate = data.closingDate ? new Date(data.closingDate) : null;

  if (Object.keys(updateData).length > 1) {
    await db.update(jobVacancies).set(updateData).where(eq(jobVacancies.id, id));
  }

  return getVacancyById(id);
}

export async function removeVacancy(id: string) {
  await getVacancyById(id);
  await db.update(jobVacancies).set({ deletedAt: new Date() }).where(eq(jobVacancies.id, id));
}

// --- Published vacancies ---

export async function listPublishedVacancies(query: ListJobVacanciesQuery) {
  const now = new Date();
  const where = and(
    eq(jobVacancies.isPublished, true),
    eq(jobVacancies.isActive, true),
    isNull(jobVacancies.deletedAt),
    or(isNull(jobVacancies.closingDate), gte(jobVacancies.closingDate, now))
  );

  const totalItems = await db.$count(jobVacancies, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: jobVacancies.id,
      title: jobVacancies.title,
      isActive: jobVacancies.isActive,
      isPublished: jobVacancies.isPublished,
      publicationDate: jobVacancies.publicationDate,
      closingDate: jobVacancies.closingDate,
      createdAt: jobVacancies.createdAt,
      updatedAt: jobVacancies.updatedAt,
      creator: { id: users.id, username: users.username },
    })
    .from(jobVacancies)
    .innerJoin(users, eq(jobVacancies.createdBy, users.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(jobVacancies.createdAt);

  return {
    data: rows.map((row) => ({
      ...row,
      publicationDate: row.publicationDate ? row.publicationDate.toISOString() : null,
      closingDate: row.closingDate ? row.closingDate.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getPublishedVacancyById(id: string): Promise<PublicJobVacancyResponse> {
  const now = new Date();
  const vacancy = await db.query.jobVacancies.findFirst({
    where: and(
      eq(jobVacancies.id, id),
      isNull(jobVacancies.deletedAt),
      eq(jobVacancies.isPublished, true),
      eq(jobVacancies.isActive, true),
      or(isNull(jobVacancies.closingDate), gte(jobVacancies.closingDate, now))
    ),
    with: { creator: true },
  });

  if (!vacancy) {
    throw new NotFoundError('Job vacancy', id);
  }

  const creator = vacancy.creator;

  return {
    id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    requirements: vacancy.requirements,
    publicationDate: vacancy.publicationDate ? vacancy.publicationDate.toISOString() : null,
    closingDate: vacancy.closingDate ? vacancy.closingDate.toISOString() : null,
    creator: creator ? { id: creator.id, username: creator.username } : { id: '', username: '' },
    createdAt: vacancy.createdAt ? vacancy.createdAt.toISOString() : '',
    updatedAt: vacancy.updatedAt ? vacancy.updatedAt.toISOString() : '',
  };
}

// --- Public Apply ---

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

// --- Candidates ---

export async function listCandidates(query: ListCandidatesQuery) {
  const conditions = [];

  if (query.search) {
    conditions.push(
      or(
        ilike(candidates.firstName, `%${query.search}%`),
        ilike(candidates.lastName, `%${query.search}%`),
        ilike(candidates.email, `%${query.search}%`),
        ilike(candidates.nationalId, `%${query.search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalItems = await db.$count(candidates, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(candidates)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(candidates.createdAt);

  return {
    data: rows.map((row) => ({
      id: row.id,
      nationalId: row.nationalId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      address: row.address,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getCandidateById(id: string) {
  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, id),
  });

  if (!candidate) {
    throw new NotFoundError('Candidate', id);
  }

  return {
    id: candidate.id,
    nationalId: candidate.nationalId,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    phone: candidate.phone,
    address: candidate.address,
    createdAt: candidate.createdAt ? candidate.createdAt.toISOString() : '',
    updatedAt: candidate.updatedAt ? candidate.updatedAt.toISOString() : '',
  };
}

export async function createCandidate(data: CreateCandidateRequest) {
  const normalizedEmail = data.email.toLowerCase();

  const existing = await db
    .select()
    .from(candidates)
    .where(or(eq(candidates.email, normalizedEmail), eq(candidates.nationalId, data.nationalId)));

  if (existing.length > 0) {
    throw new ConflictError('Candidate with this email or national ID already exists');
  }

  const [candidate] = await db
    .insert(candidates)
    .values({
      nationalId: data.nationalId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: normalizedEmail,
      phone: data.phone,
      address: data.address,
    })
    .returning();

  if (!candidate) {
    throw new InternalServerError('Failed to create candidate');
  }

  return getCandidateById(candidate.id);
}

export async function updateCandidate(id: string, data: UpdateCandidateRequest) {
  await getCandidateById(id);

  const updateData: Partial<typeof candidates.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.nationalId !== undefined) updateData.nationalId = data.nationalId;
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;

  if (Object.keys(updateData).length > 1) {
    await db.update(candidates).set(updateData).where(eq(candidates.id, id));
  }

  return getCandidateById(id);
}

export async function removeCandidate(id: string) {
  await getCandidateById(id);
  await db.delete(candidates).where(eq(candidates.id, id));
}

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

// --- Job Applications ---

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

// --- Candidate Resumes ---

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
