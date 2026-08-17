import { PostConversationProcessor } from './post-conversation.processor';

const input = {
  userId: 'user-1',
  sessionId: 'session-1',
  sourceEventId: 'event-1',
  userMessage: 'Estou ansioso e dormi umas seis horas.',
  assistantReply: 'Entendo. Como isso está pesando para você?',
  capturedAt: new Date('2026-08-14T12:00:00Z'),
  timezone: 'America/Sao_Paulo'
};

const consent = {
  canUseConversationData: true,
  canExtractWellbeing: true,
  timezone: 'America/Sao_Paulo'
};

function createProcessor(options?: { output?: Record<string, unknown>; consents?: unknown[] }) {
  const output = options?.output ?? {
    currentContext: null,
    memory: null,
    pattern: null,
    mood: null,
    sleep: null
  };
  const extractor = { extract: jest.fn().mockResolvedValue(output) };
  const users = {
    findById: jest
      .fn()
      .mockResolvedValueOnce({ hasScheduledDeletion: () => false })
      .mockResolvedValueOnce({ hasScheduledDeletion: () => false })
  };
  const consentPolicy = {
    resolve: jest.fn()
  };
  for (const resolved of options?.consents ?? [consent, consent]) {
    consentPolicy.resolve.mockReturnValueOnce(resolved);
  }
  const currentContexts = { replace: jest.fn().mockResolvedValue(undefined) };
  const memory = { consolidate: jest.fn().mockResolvedValue(undefined) };
  const mood = { createFromChat: jest.fn().mockResolvedValue(undefined) };
  const sleep = { createFromChat: jest.fn().mockResolvedValue(undefined) };
  const processor = new PostConversationProcessor(
    extractor as never,
    users as never,
    consentPolicy,
    currentContexts as never,
    memory as never,
    mood as never,
    sleep as never,
    { get: jest.fn().mockReturnValue(0.85) } as never
  );
  return { processor, extractor, currentContexts, memory, mood, sleep };
}

describe('PostConversationProcessor', () => {
  it('persists nothing when structured extraction returns no information', async () => {
    const dependencies = createProcessor();
    await dependencies.processor.process(input);
    expect(dependencies.currentContexts.replace).not.toHaveBeenCalled();
    expect(dependencies.memory.consolidate).not.toHaveBeenCalled();
    expect(dependencies.mood.createFromChat).not.toHaveBeenCalled();
    expect(dependencies.sleep.createFromChat).not.toHaveBeenCalled();
  });

  it('revalidates consent after the model call and blocks every write after revocation', async () => {
    const output = {
      currentContext: {
        summary: 'Conflito atual.',
        topics: ['trabalho'],
        pendingItems: [],
        confidence: 0.95
      },
      memory: null,
      pattern: null,
      mood: null,
      sleep: null
    };
    const dependencies = createProcessor({
      output,
      consents: [consent, { ...consent, canUseConversationData: false, canExtractWellbeing: false }]
    });
    await dependencies.processor.process(input);
    expect(dependencies.extractor.extract).toHaveBeenCalled();
    expect(dependencies.currentContexts.replace).not.toHaveBeenCalled();
  });

  it('routes validated extraction to the responsible persistence components', async () => {
    const output = {
      currentContext: {
        summary: 'Lidando com estresse e pouco sono.',
        topics: ['estresse', 'sono'],
        pendingItems: [],
        confidence: 0.96
      },
      memory: {
        summary: 'Relatou estresse após um conflito.',
        kind: 'event',
        topics: ['estresse', 'conflito'],
        eventDate: null,
        importance: 0.8,
        confidence: 0.95
      },
      pattern: null,
      mood: {
        primaryEmotion: 'estresse',
        secondaryEmotions: [],
        intensity: null,
        energy: null,
        valence: null,
        occurredAt: null,
        period: null,
        context: 'após um conflito',
        confidence: 0.94
      },
      sleep: {
        durationMinutes: 360,
        durationMinMinutes: null,
        durationMaxMinutes: null,
        bedtime: null,
        wakeTime: null,
        quality: null,
        awakenings: null,
        wakeFeeling: null,
        date: null,
        period: null,
        precision: 'approximate',
        confidence: 0.95
      }
    };
    const dependencies = createProcessor({ output });
    await dependencies.processor.process(input);
    expect(dependencies.currentContexts.replace).toHaveBeenCalledWith(
      expect.objectContaining({ sourceEventId: 'event-1' })
    );
    expect(dependencies.memory.consolidate).toHaveBeenCalled();
    expect(dependencies.mood.createFromChat).toHaveBeenCalled();
    expect(dependencies.sleep.createFromChat).toHaveBeenCalled();
  });
});
