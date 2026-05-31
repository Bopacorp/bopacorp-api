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
import { advisorSupervisors, employees, orgRoles, profiles } from './core.js';
import { candidateResumes, candidates, jobApplications, jobVacancies } from './employability.js';

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
  advisorOf: many(advisorSupervisors, { relationName: 'advisor' }),
  supervisorOf: many(advisorSupervisors, { relationName: 'supervisor' }),
  contentBlocks: many(contentBlocks),
  contactRequests: many(contactRequests),
  jobVacancies: many(jobVacancies),
  reviewedApplications: many(jobApplications),
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
  advisor: one(users, {
    fields: [advisorSupervisors.advisorId],
    references: [users.id],
    relationName: 'advisor',
  }),
  supervisor: one(users, {
    fields: [advisorSupervisors.supervisorId],
    references: [users.id],
    relationName: 'supervisor',
  }),
}));

export const orgRolesRelations = relations(orgRoles, ({ many }) => ({
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  orgRole: one(orgRoles, {
    fields: [employees.orgRoleId],
    references: [orgRoles.id],
  }),
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
