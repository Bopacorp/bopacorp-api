import type {
  CreateDepartmentRequest,
  ListDepartmentsQuery,
  UpdateDepartmentRequest,
} from '@bopacorp/shared/core';
import { departments } from '@db/schema/core.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}));

const service = await import('./departments.service.js');

const DEPARTMENT_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_DEPARTMENT_ID = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-08-13T12:00:00.000Z');

function departmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DEPARTMENT_ID,
    code: 'ADV',
    name: 'Advising',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function hasQueryValue(expression: unknown, expected: unknown): boolean {
  if (expression === expected) return true;
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { value?: unknown; queryChunks?: unknown[] };
  if (candidate.value === expected) return true;
  if (Array.isArray(candidate.value) && candidate.value.includes(expected)) return true;
  return candidate.queryChunks?.some((chunk) => hasQueryValue(chunk, expected)) ?? false;
}

function hasColumnName(expression: unknown, expected: string): boolean {
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { name?: unknown; queryChunks?: unknown[] };
  return (
    candidate.name === expected ||
    candidate.queryChunks?.some((chunk) => hasColumnName(chunk, expected)) === true
  );
}

function hasColumnReference(expression: unknown, expected: object): boolean {
  if (expression === expected) return true;
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { value?: unknown; queryChunks?: unknown[] };
  return (
    hasColumnReference(candidate.value, expected) ||
    candidate.queryChunks?.some((chunk) => hasColumnReference(chunk, expected)) === true
  );
}

function selectResult(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  builder.orderBy.mockResolvedValue(result);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function listResult(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function insertResult(result: unknown) {
  const builder = { values: vi.fn(), returning: vi.fn() };
  builder.values.mockReturnValue(builder);
  builder.returning.mockResolvedValue(result);
  mockInsert.mockReturnValueOnce(builder);
  return builder;
}

function updateResult(result: unknown) {
  const builder = { set: vi.fn(), where: vi.fn(), returning: vi.fn() };
  builder.set.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.returning.mockResolvedValue(result);
  mockUpdate.mockReturnValueOnce(builder);
  return builder;
}

describe('departments service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('lists departments in code order with no filters', async () => {
    const rows = [departmentRow()];
    const builder = listResult(rows);

    await expect(service.listDepartments({})).resolves.toEqual(rows);
    expect(builder.from).toHaveBeenCalledWith(departments);
    expect(builder.where).toHaveBeenCalledWith(undefined);
    expect(builder.orderBy).toHaveBeenCalledTimes(1);
    expect(hasColumnName(builder.orderBy.mock.calls[0]?.[0], 'code')).toBe(true);
  });

  it('applies search and activity filters and returns an empty list', async () => {
    const builder = listResult([]);
    const query: ListDepartmentsQuery = { search: 'adv', isActive: false };

    await expect(service.listDepartments(query)).resolves.toEqual([]);
    expect(builder.from).toHaveBeenCalledWith(departments);
    const condition = builder.where.mock.calls[0]?.[0];
    expect(hasQueryValue(condition, '%adv%')).toBe(true);
    expect(hasQueryValue(condition, false)).toBe(true);
    expect(hasColumnReference(condition, departments.isActive)).toBe(true);
    expect(hasColumnReference(condition, departments.code)).toBe(true);
    expect(hasColumnReference(condition, departments.name)).toBe(true);
    expect(builder.orderBy).toHaveBeenCalledTimes(1);
  });

  it('returns a department by id and rejects a missing department', async () => {
    const row = departmentRow();
    const existingBuilder = selectResult([row]);
    await expect(service.getDepartmentById(DEPARTMENT_ID)).resolves.toEqual(row);
    expect(existingBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(existingBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(existingBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);

    selectResult([]);
    await expect(service.getDepartmentById(DEPARTMENT_ID)).rejects.toThrow(NotFoundError);
  });

  it('rejects duplicate codes and returns a successfully inserted department', async () => {
    const input: CreateDepartmentRequest = { code: 'ADV', name: 'Advising' };
    const duplicateBuilder = selectResult([departmentRow()]);
    await expect(service.createDepartment(input)).rejects.toThrow(ConflictError);
    expect(duplicateBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(duplicateBuilder.where.mock.calls[0]?.[0], input.code)).toBe(true);
    expect(hasColumnReference(duplicateBuilder.where.mock.calls[0]?.[0], departments.code)).toBe(
      true
    );
    expect(mockInsert).not.toHaveBeenCalled();

    selectResult([]);
    const inserted = departmentRow();
    const insertBuilder = insertResult([inserted]);
    await expect(service.createDepartment(input)).resolves.toEqual(inserted);
    expect(mockInsert).toHaveBeenCalledWith(departments);
    expect(insertBuilder.values).toHaveBeenCalledWith(input);
  });

  it('reports an internal error when creation does not return a row', async () => {
    selectResult([]);
    insertResult([]);
    await expect(service.createDepartment({ code: 'ADV', name: 'Advising' })).rejects.toThrow(
      InternalServerError
    );
  });

  it('updates provided fields and returns the updated department', async () => {
    const existingBuilder = selectResult([departmentRow()]);
    const duplicateBuilder = selectResult([]);
    const updated = departmentRow({ code: 'STU', name: 'Student Services', isActive: false });
    const updateBuilder = updateResult([updated]);
    const input: UpdateDepartmentRequest = {
      code: 'STU',
      name: 'Student Services',
      isActive: false,
    };

    await expect(service.updateDepartment(DEPARTMENT_ID, input)).resolves.toEqual(updated);
    expect(existingBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(existingBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(existingBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
    expect(duplicateBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(duplicateBuilder.where.mock.calls[0]?.[0], input.code)).toBe(true);
    expect(hasColumnReference(duplicateBuilder.where.mock.calls[0]?.[0], departments.code)).toBe(
      true
    );
    expect(mockUpdate).toHaveBeenCalledWith(departments);
    expect(updateBuilder.set).toHaveBeenCalledWith({ ...input, updatedAt: NOW });
    expect(hasQueryValue(updateBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(updateBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
  });

  it('rejects updates for a missing department or a conflicting code', async () => {
    const missingBuilder = selectResult([]);
    await expect(service.updateDepartment(DEPARTMENT_ID, { name: 'New name' })).rejects.toThrow(
      NotFoundError
    );
    expect(missingBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(missingBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(missingBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();

    const existingBuilder = selectResult([departmentRow()]);
    const input: UpdateDepartmentRequest = { code: 'STU' };
    const duplicateBuilder = selectResult([
      departmentRow({ id: OTHER_DEPARTMENT_ID, code: 'STU' }),
    ]);
    await expect(service.updateDepartment(DEPARTMENT_ID, input)).rejects.toThrow(ConflictError);
    expect(existingBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(existingBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(existingBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
    expect(duplicateBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(duplicateBuilder.where.mock.calls[0]?.[0], input.code)).toBe(true);
    expect(hasColumnReference(duplicateBuilder.where.mock.calls[0]?.[0], departments.code)).toBe(
      true
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('reports a missing row if the final update returns no department', async () => {
    const existingBuilder = selectResult([departmentRow()]);
    const updateBuilder = updateResult([]);
    await expect(service.updateDepartment(DEPARTMENT_ID, { name: 'New name' })).rejects.toThrow(
      NotFoundError
    );
    expect(existingBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(existingBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(existingBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(departments);
    expect(updateBuilder.set).toHaveBeenCalledWith({ name: 'New name', updatedAt: NOW });
    expect(hasQueryValue(updateBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(updateBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
  });

  it('checks existence then disables the department with a timestamp', async () => {
    const existingBuilder = selectResult([departmentRow()]);
    const updateBuilder = updateResult([]);
    await expect(service.disableDepartment(DEPARTMENT_ID)).resolves.toBeUndefined();
    expect(existingBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(existingBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(existingBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(departments);
    expect(updateBuilder.set).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });
    expect(hasQueryValue(updateBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(updateBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
  });

  it('rejects a missing department before attempting to disable it', async () => {
    const existingBuilder = selectResult([]);

    await expect(service.disableDepartment(DEPARTMENT_ID)).rejects.toThrow(NotFoundError);
    expect(existingBuilder.from).toHaveBeenCalledWith(departments);
    expect(hasQueryValue(existingBuilder.where.mock.calls[0]?.[0], DEPARTMENT_ID)).toBe(true);
    expect(hasColumnReference(existingBuilder.where.mock.calls[0]?.[0], departments.id)).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
