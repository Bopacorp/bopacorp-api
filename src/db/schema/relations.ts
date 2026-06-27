import { relations } from 'drizzle-orm';
import {
  auditLogs,
  authTokens,
  loginLogs,
  modules,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from './auth.js';
import {
  ageConditions,
  benefitTypes,
  catalogItems,
  categories,
  connectivityDetails,
  contactRequests,
  contentBlocks,
  contentTypes,
  contractTypes,
  deviceDetails,
  digitalDetails,
  geoZones,
  itemBenefits,
  itemTypes,
  legalConditions,
  roamingDetails,
  segments,
  temporalConditions,
  tiers,
  voiceDetails,
} from './catalog.js';
import { advisorSupervisors, departments, employees, orgRoles, profiles } from './core.js';
import {
  businessClients,
  negotiationStateHistory,
  negotiationStates,
  negotiations,
  visits,
  visitTypes,
} from './crm.js';
import { documentStateHistory, documentTypes, negotiationDocuments } from './documents.js';
import { candidateResumes, candidates, jobApplications, jobVacancies } from './employability.js';
import { matrixAttachments, offerMatrices } from './matrices.js';
import { notifications } from './notifications.js';
import { reportExports, salesTargets } from './reports.js';

export const modulesRelations = relations(modules, ({ one, many }) => ({
  parent: one(modules, {
    fields: [modules.parentId],
    references: [modules.id],
    relationName: 'moduleParent',
  }),
  children: many(modules, { relationName: 'moduleParent' }),
  permissions: many(permissions),
}));

export const permissionsRelations = relations(permissions, ({ one, many }) => ({
  module: one(modules, {
    fields: [permissions.moduleId],
    references: [modules.id],
  }),
  rolePermissions: many(rolePermissions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  userRoles: many(userRoles),
  authTokens: many(authTokens),
  loginLogs: many(loginLogs),
  auditLogs: many(auditLogs),
  profile: one(profiles),
  employee: one(employees),
  contentBlocks: many(contentBlocks),
  contactRequests: many(contactRequests),
  jobVacancies: many(jobVacancies),
  reviewedApplications: many(jobApplications),
  verifiedVisits: many(visits, { relationName: 'verifiedBy' }),
  stateHistoryChanges: many(negotiationStateHistory, { relationName: 'changedBy' }),
  createdMatrices: many(offerMatrices, { relationName: 'matrixCreator' }),
  matrixAttachments: many(matrixAttachments),
  uploadedDocuments: many(negotiationDocuments, { relationName: 'documentUploader' }),
  reviewedDocuments: many(negotiationDocuments, { relationName: 'documentReviewer' }),
  documentStateChanges: many(documentStateHistory),
  createdTargets: many(salesTargets, { relationName: 'targetCreator' }),
  generatedReports: many(reportExports, { relationName: 'reportGenerator' }),
  receivedNotifications: many(notifications),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const authTokensRelations = relations(authTokens, ({ one }) => ({
  user: one(users, {
    fields: [authTokens.userId],
    references: [users.id],
  }),
}));

export const loginLogsRelations = relations(loginLogs, ({ one }) => ({
  user: one(users, {
    fields: [loginLogs.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// ── Catalog ──

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryParent',
  }),
  children: many(categories, { relationName: 'categoryParent' }),
  catalogItems: many(catalogItems),
}));

export const catalogItemsRelations = relations(catalogItems, ({ one, many }) => ({
  category: one(categories, {
    fields: [catalogItems.categoryId],
    references: [categories.id],
  }),
  itemType: one(itemTypes, {
    fields: [catalogItems.itemTypeId],
    references: [itemTypes.id],
  }),
  contractType: one(contractTypes, {
    fields: [catalogItems.contractTypeId],
    references: [contractTypes.id],
  }),
  segment: one(segments, {
    fields: [catalogItems.segmentId],
    references: [segments.id],
  }),
  tier: one(tiers, {
    fields: [catalogItems.tierId],
    references: [tiers.id],
  }),
  voiceDetails: one(voiceDetails),
  connectivityDetails: one(connectivityDetails),
  digitalDetails: one(digitalDetails),
  roamingDetails: one(roamingDetails),
  deviceDetails: one(deviceDetails),
  benefits: many(itemBenefits),
  ageConditions: one(ageConditions),
  legalConditions: one(legalConditions),
  temporalConditions: one(temporalConditions),
  contactRequests: many(contactRequests),
}));

export const voiceDetailsRelations = relations(voiceDetails, ({ one }) => ({
  item: one(catalogItems, {
    fields: [voiceDetails.itemId],
    references: [catalogItems.id],
  }),
}));

export const connectivityDetailsRelations = relations(connectivityDetails, ({ one }) => ({
  item: one(catalogItems, {
    fields: [connectivityDetails.itemId],
    references: [catalogItems.id],
  }),
}));

export const digitalDetailsRelations = relations(digitalDetails, ({ one }) => ({
  item: one(catalogItems, {
    fields: [digitalDetails.itemId],
    references: [catalogItems.id],
  }),
}));

export const roamingDetailsRelations = relations(roamingDetails, ({ one }) => ({
  item: one(catalogItems, {
    fields: [roamingDetails.itemId],
    references: [catalogItems.id],
  }),
  geoZone: one(geoZones, {
    fields: [roamingDetails.geoZoneId],
    references: [geoZones.id],
  }),
}));

export const deviceDetailsRelations = relations(deviceDetails, ({ one }) => ({
  item: one(catalogItems, {
    fields: [deviceDetails.itemId],
    references: [catalogItems.id],
  }),
}));

export const itemBenefitsRelations = relations(itemBenefits, ({ one }) => ({
  item: one(catalogItems, {
    fields: [itemBenefits.itemId],
    references: [catalogItems.id],
  }),
  benefitType: one(benefitTypes, {
    fields: [itemBenefits.benefitTypeId],
    references: [benefitTypes.id],
  }),
}));

export const ageConditionsRelations = relations(ageConditions, ({ one }) => ({
  item: one(catalogItems, {
    fields: [ageConditions.itemId],
    references: [catalogItems.id],
  }),
}));

export const legalConditionsRelations = relations(legalConditions, ({ one }) => ({
  item: one(catalogItems, {
    fields: [legalConditions.itemId],
    references: [catalogItems.id],
  }),
}));

export const temporalConditionsRelations = relations(temporalConditions, ({ one }) => ({
  item: one(catalogItems, {
    fields: [temporalConditions.itemId],
    references: [catalogItems.id],
  }),
}));

export const contentBlocksRelations = relations(contentBlocks, ({ one }) => ({
  contentType: one(contentTypes, {
    fields: [contentBlocks.contentTypeId],
    references: [contentTypes.id],
  }),
  updater: one(users, {
    fields: [contentBlocks.updatedBy],
    references: [users.id],
  }),
}));

export const contactRequestsRelations = relations(contactRequests, ({ one }) => ({
  item: one(catalogItems, {
    fields: [contactRequests.itemId],
    references: [catalogItems.id],
  }),
  attendant: one(users, {
    fields: [contactRequests.attendedBy],
    references: [users.id],
  }),
}));

export const itemTypesRelations = relations(itemTypes, ({ many }) => ({
  catalogItems: many(catalogItems),
}));

export const contractTypesRelations = relations(contractTypes, ({ many }) => ({
  catalogItems: many(catalogItems),
}));

export const segmentsRelations = relations(segments, ({ many }) => ({
  catalogItems: many(catalogItems),
}));

export const tiersRelations = relations(tiers, ({ many }) => ({
  catalogItems: many(catalogItems),
}));

export const geoZonesRelations = relations(geoZones, ({ many }) => ({
  roamingDetails: many(roamingDetails),
}));

export const benefitTypesRelations = relations(benefitTypes, ({ many }) => ({
  itemBenefits: many(itemBenefits),
}));

export const contentTypesRelations = relations(contentTypes, ({ many }) => ({
  contentBlocks: many(contentBlocks),
}));

// ── Core ──

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const advisorSupervisorsRelations = relations(advisorSupervisors, ({ one }) => ({
  advisor: one(employees, {
    fields: [advisorSupervisors.advisorId],
    references: [employees.userId],
    relationName: 'advisor',
  }),
  supervisor: one(employees, {
    fields: [advisorSupervisors.supervisorId],
    references: [employees.userId],
    relationName: 'supervisor',
  }),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  orgRoles: many(orgRoles),
}));

export const orgRolesRelations = relations(orgRoles, ({ one, many }) => ({
  department: one(departments, {
    fields: [orgRoles.departmentId],
    references: [departments.id],
  }),
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  orgRole: one(orgRoles, {
    fields: [employees.orgRoleId],
    references: [orgRoles.id],
  }),
  advisorOf: many(advisorSupervisors, { relationName: 'advisor' }),
  supervisorOf: many(advisorSupervisors, { relationName: 'supervisor' }),
  businessClients: many(businessClients),
  negotiations: many(negotiations),
  visits: many(visits),
}));

// ── Employability ──

export const candidatesRelations = relations(candidates, ({ many }) => ({
  jobApplications: many(jobApplications),
  resumes: many(candidateResumes),
}));

export const jobVacanciesRelations = relations(jobVacancies, ({ one, many }) => ({
  creator: one(users, {
    fields: [jobVacancies.createdBy],
    references: [users.id],
  }),
  applications: many(jobApplications),
}));

export const jobApplicationsRelations = relations(jobApplications, ({ one }) => ({
  vacancy: one(jobVacancies, {
    fields: [jobApplications.vacancyId],
    references: [jobVacancies.id],
  }),
  candidate: one(candidates, {
    fields: [jobApplications.candidateId],
    references: [candidates.id],
  }),
  reviewer: one(users, {
    fields: [jobApplications.reviewedBy],
    references: [users.id],
  }),
  resumes: one(candidateResumes),
}));

export const candidateResumesRelations = relations(candidateResumes, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateResumes.candidateId],
    references: [candidates.id],
  }),
  application: one(jobApplications, {
    fields: [candidateResumes.applicationId],
    references: [jobApplications.id],
  }),
}));

// ── CRM ──

export const negotiationStatesRelations = relations(negotiationStates, ({ many }) => ({
  negotiations: many(negotiations),
  stateHistory: many(negotiationStateHistory),
}));

export const visitTypesRelations = relations(visitTypes, ({ many }) => ({
  visits: many(visits),
}));

export const businessClientsRelations = relations(businessClients, ({ one, many }) => ({
  advisor: one(employees, {
    fields: [businessClients.advisorId],
    references: [employees.userId],
  }),
  negotiations: many(negotiations),
  visits: many(visits),
}));

export const negotiationsRelations = relations(negotiations, ({ one, many }) => ({
  client: one(businessClients, {
    fields: [negotiations.clientId],
    references: [businessClients.id],
  }),
  advisor: one(employees, {
    fields: [negotiations.advisorId],
    references: [employees.userId],
  }),
  state: one(negotiationStates, {
    fields: [negotiations.stateId],
    references: [negotiationStates.id],
  }),
  visits: many(visits),
  stateHistory: many(negotiationStateHistory),
  offerMatrices: many(offerMatrices),
  documents: many(negotiationDocuments),
}));

export const visitsRelations = relations(visits, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [visits.negotiationId],
    references: [negotiations.id],
  }),
  client: one(businessClients, {
    fields: [visits.clientId],
    references: [businessClients.id],
  }),
  advisor: one(employees, {
    fields: [visits.advisorId],
    references: [employees.userId],
  }),
  verifiedBy: one(users, {
    fields: [visits.verifiedBy],
    references: [users.id],
    relationName: 'verifiedBy',
  }),
  visitType: one(visitTypes, {
    fields: [visits.visitTypeId],
    references: [visitTypes.id],
  }),
}));

export const negotiationStateHistoryRelations = relations(negotiationStateHistory, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [negotiationStateHistory.negotiationId],
    references: [negotiations.id],
  }),
  previousState: one(negotiationStates, {
    fields: [negotiationStateHistory.previousStateId],
    references: [negotiationStates.id],
  }),
  newState: one(negotiationStates, {
    fields: [negotiationStateHistory.newStateId],
    references: [negotiationStates.id],
  }),
  changedBy: one(users, {
    fields: [negotiationStateHistory.changedBy],
    references: [users.id],
    relationName: 'changedBy',
  }),
}));

// ── Matrices ──

export const offerMatricesRelations = relations(offerMatrices, ({ one, many }) => ({
  negotiation: one(negotiations, {
    fields: [offerMatrices.negotiationId],
    references: [negotiations.id],
  }),
  creator: one(users, {
    fields: [offerMatrices.creatorId],
    references: [users.id],
    relationName: 'matrixCreator',
  }),
  attachments: many(matrixAttachments),
}));

export const matrixAttachmentsRelations = relations(matrixAttachments, ({ one }) => ({
  matrix: one(offerMatrices, {
    fields: [matrixAttachments.matrixId],
    references: [offerMatrices.id],
  }),
  uploadedBy: one(users, {
    fields: [matrixAttachments.uploadedBy],
    references: [users.id],
  }),
}));

// ── Documents ──

export const documentTypesRelations = relations(documentTypes, ({ many }) => ({
  negotiationDocuments: many(negotiationDocuments),
}));

export const negotiationDocumentsRelations = relations(negotiationDocuments, ({ one, many }) => ({
  negotiation: one(negotiations, {
    fields: [negotiationDocuments.negotiationId],
    references: [negotiations.id],
  }),
  documentType: one(documentTypes, {
    fields: [negotiationDocuments.documentTypeId],
    references: [documentTypes.id],
  }),
  uploadedBy: one(users, {
    fields: [negotiationDocuments.uploadedBy],
    references: [users.id],
    relationName: 'documentUploader',
  }),
  reviewedBy: one(users, {
    fields: [negotiationDocuments.reviewedBy],
    references: [users.id],
    relationName: 'documentReviewer',
  }),
  stateHistory: many(documentStateHistory),
}));

export const documentStateHistoryRelations = relations(documentStateHistory, ({ one }) => ({
  document: one(negotiationDocuments, {
    fields: [documentStateHistory.documentId],
    references: [negotiationDocuments.id],
  }),
  changedBy: one(users, {
    fields: [documentStateHistory.changedBy],
    references: [users.id],
  }),
}));

// ── Reports ──

export const salesTargetsRelations = relations(salesTargets, ({ one }) => ({
  creator: one(users, {
    fields: [salesTargets.createdBy],
    references: [users.id],
    relationName: 'targetCreator',
  }),
}));

export const reportExportsRelations = relations(reportExports, ({ one }) => ({
  generator: one(users, {
    fields: [reportExports.generatedBy],
    references: [users.id],
    relationName: 'reportGenerator',
  }),
}));

// ── Notifications ──

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
  }),
}));
