import { MemoryService } from '../memory.service';

const input = {
  userId: 'user-1',
  memory: {
    summary: 'Teve um conflito no trabalho.',
    kind: 'event' as const,
    topics: ['Trabalho', 'conflito'],
    eventDate: null,
    importance: 0.7,
    confidence: 0.95
  },
  pattern: {
    summary: 'Relata dificuldade recorrente em conflitos no trabalho.',
    topics: ['trabalho', 'conflito']
  },
  sessionId: 'session-1',
  sourceEventId: 'event-1',
  capturedAt: new Date('2026-08-14T12:00:00Z'),
  extractorVersion: 'extractor.v1',
  promptVersion: 'memory.v1',
  patternPromptVersion: 'pattern.v1'
};

describe('MemoryService', () => {
  it('does not turn a single occurrence into a pattern', async () => {
    const repository = {
      createMemory: jest.fn().mockResolvedValue(true),
      countEvidence: jest.fn().mockResolvedValue({ count: 1, first: input.capturedAt }),
      upsertPattern: jest.fn()
    };

    await new MemoryService(repository as never).consolidate(input);

    expect(repository.createMemory).toHaveBeenCalled();
    expect(repository.upsertPattern).not.toHaveBeenCalled();
  });

  it('consolidates a pattern only after multiple matching evidences', async () => {
    const first = new Date('2026-08-01T12:00:00Z');
    const repository = {
      createMemory: jest.fn().mockResolvedValue(true),
      countEvidence: jest.fn().mockResolvedValue({ count: 2, first }),
      upsertPattern: jest.fn().mockResolvedValue(undefined)
    };

    await new MemoryService(repository as never).consolidate(input);

    expect(repository.upsertPattern).toHaveBeenCalledWith(
      expect.objectContaining({ evidenceCount: 2, firstObservedAt: first })
    );
  });

  it('is idempotent when the memory source event already exists', async () => {
    const repository = {
      createMemory: jest.fn().mockResolvedValue(false),
      countEvidence: jest.fn(),
      upsertPattern: jest.fn()
    };

    await new MemoryService(repository as never).consolidate(input);

    expect(repository.countEvidence).not.toHaveBeenCalled();
    expect(repository.upsertPattern).not.toHaveBeenCalled();
  });
});
