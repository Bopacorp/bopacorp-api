import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  decimal,
  index,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const employabilitySchema = pgSchema('employability');

export const applicationStateEnum = pgEnum('application_state', [
  'DRAFT',
  'PENDING',
  'ACCEPTED',
  'REJECTED',
]);

export const candidates = employabilitySchema.table(
  'candidates',
  {
    id: uuid().primaryKey().defaultRandom(),
    nationalId: varchar('national_id', { length: 20 }).notNull().unique(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar({ length: 150 }).notNull().unique(),
    phone: varchar({ length: 20 }),
    address: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_candidates_email').on(t.email),
    index('idx_candidates_national_id').on(t.nationalId),
  ]
);

export const jobVacancies = employabilitySchema.table(
  'job_vacancies',
  {
    id: uuid().primaryKey().defaultRandom(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: varchar({ length: 255 }).notNull(),
    description: text().notNull(),
    requirements: text().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isPublished: boolean('is_published').notNull().default(false),
    publicationDate: timestamp('publication_date', { withTimezone: true }),
    closingDate: timestamp('closing_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_job_vacancies_created_by').on(t.createdBy),
    index('idx_job_vacancies_published').on(t.isPublished).where(sql`deleted_at IS NULL`),
    index('idx_job_vacancies_active').on(t.isActive).where(sql`deleted_at IS NULL`),
    index('idx_job_vacancies_closing').on(t.closingDate).where(sql`deleted_at IS NULL`),
    check(
      'chk_vacancy_dates',
      sql`closing_date IS NULL OR publication_date IS NULL OR closing_date >= publication_date`
    ),
  ]
);

export const jobApplications = employabilitySchema.table(
  'job_applications',
  {
    id: uuid().primaryKey().defaultRandom(),
    vacancyId: uuid('vacancy_id')
      .notNull()
      .references(() => jobVacancies.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    state: applicationStateEnum().notNull().default('DRAFT'),
    coverLetter: text('cover_letter'),
    reviewNotes: text('review_notes'),
    reviewDate: timestamp('review_date', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_application_per_vacancy').on(t.vacancyId, t.candidateId),
    index('idx_job_applications_vacancy').on(t.vacancyId),
    index('idx_job_applications_candidate').on(t.candidateId),
    index('idx_job_applications_reviewed').on(t.reviewedBy),
    index('idx_job_applications_state').on(t.state).where(sql`deleted_at IS NULL`),
  ]
);

export const candidateResumes = employabilitySchema.table(
  'candidate_resumes',
  {
    id: uuid().primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => jobApplications.id, {
      onDelete: 'set null',
    }),
    filename: varchar({ length: 255 }).notNull(),
    fileExtension: varchar('file_extension', { length: 10 }).notNull(),
    fileSizeMb: decimal('file_size_mb', { precision: 8, scale: 2 }).notNull(),
    storagePath: varchar('storage_path', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_candidate_resumes_candidate').on(t.candidateId),
    index('idx_candidate_resumes_application').on(t.applicationId),
    check('chk_file_size', sql`file_size_mb > 0 AND file_size_mb <= 50`),
  ]
);
