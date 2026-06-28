import { NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockSet = vi.fn(() => ({ where: vi.fn() }));
const mockValues = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    query: {
      negotiations: { findFirst: mockFindFirst },
      negotiationStates: { findFirst: mockFindFirst },
    },
    update: mockUpdate,
    insert: mockInsert,
  },
}));

vi.mock('@config/env.js', () => ({ env: {} }));
vi.mock('@lib/storage.js', () => ({}));
vi.mock('@modules/document-uploads/document-uploads.service.js', () => ({}));
vi.mock('@modules/notifications/notifications.service.js', () => ({ createNotification: vi.fn() }));
vi.mock('@shared/utils/scoping.js', () => ({ getSupervisedAdvisorIds: vi.fn() }));

const NEGOTIATION_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const STATE_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STATE_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeNegotiation(stateId: string = STATE_A_ID) {
  return {
    id: NEGOTIATION_ID,
    startDate: '2026-01-01',
    estimatedCloseDate: null,
    observations: null,
    isActive: true,
    client: { id: 'c1', businessName: 'ACME', contactName: 'John' },
    advisor: {
      userId: USER_ID,
      user: { username: 'jdoe', email: 'j@test.com', profile: { firstName: 'J', lastName: 'D' } },
    },
    state: { id: stateId, code: 'prospecting', name: 'Prospecting' },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  };
}

const { changeNegotiationState } = await import('./negotiations.service.js');

describe('changeNegotiationState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockSet });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  it('should change state and insert history', async () => {
    const negotiation = makeNegotiation(STATE_A_ID);
    const updatedNegotiation = makeNegotiation(STATE_B_ID);
    updatedNegotiation.state = { id: STATE_B_ID, code: 'qualification', name: 'Qualification' };

    mockFindFirst
      .mockResolvedValueOnce(negotiation)
      .mockResolvedValueOnce({ id: STATE_B_ID, code: 'qualification', name: 'Qualification' })
      .mockResolvedValueOnce(updatedNegotiation);

    const result = await changeNegotiationState(NEGOTIATION_ID, USER_ID, { stateId: STATE_B_ID });

    expect(result.state.id).toBe(STATE_B_ID);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        negotiationId: NEGOTIATION_ID,
        previousStateId: STATE_A_ID,
        newStateId: STATE_B_ID,
        changedBy: USER_ID,
      })
    );
  });

  it('should return without changes when state is the same (no-op)', async () => {
    const negotiation = makeNegotiation(STATE_A_ID);

    mockFindFirst
      .mockResolvedValueOnce(negotiation)
      .mockResolvedValueOnce({ id: STATE_A_ID, code: 'prospecting', name: 'Prospecting' });

    const result = await changeNegotiationState(NEGOTIATION_ID, USER_ID, { stateId: STATE_A_ID });

    expect(result.id).toBe(NEGOTIATION_ID);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError for non-existent negotiation', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);

    await expect(
      changeNegotiationState('non-existent-id', USER_ID, { stateId: STATE_B_ID })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError for non-existent state', async () => {
    const negotiation = makeNegotiation(STATE_A_ID);
    mockFindFirst.mockResolvedValueOnce(negotiation).mockResolvedValueOnce(undefined);

    await expect(
      changeNegotiationState(NEGOTIATION_ID, USER_ID, { stateId: 'non-existent-state' })
    ).rejects.toThrow(NotFoundError);
  });

  it('should include notes in history when provided', async () => {
    const negotiation = makeNegotiation(STATE_A_ID);
    const updatedNegotiation = makeNegotiation(STATE_B_ID);

    mockFindFirst
      .mockResolvedValueOnce(negotiation)
      .mockResolvedValueOnce({ id: STATE_B_ID, code: 'qualification', name: 'Qualification' })
      .mockResolvedValueOnce(updatedNegotiation);

    await changeNegotiationState(NEGOTIATION_ID, USER_ID, {
      stateId: STATE_B_ID,
      notes: 'Client confirmed interest',
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Client confirmed interest',
      })
    );
  });
});
