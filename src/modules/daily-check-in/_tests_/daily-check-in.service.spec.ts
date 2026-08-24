import { DailyCheckInService } from '../daily-check-in.service';
import { EMPTY_CHECK_IN_STATE } from '../daily-check-in.types';

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'check-in-1',
    userId: 'user-1',
    localDate: '2026-08-17',
    timezone: 'UTC',
    locale: 'pt-BR' as const,
    status: 'in_progress' as const,
    questionCount: 1,
    maxQuestions: 2,
    state: structuredClone(EMPTY_CHECK_IN_STATE),
    nextQuestion: 'Como você está se sentindo hoje?',
    processedRequests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function createService(
  repository: object,
  overrides: { agent?: object; mood?: object; sleep?: object } = {}
) {
  return new DailyCheckInService(
    {
      findById: jest
        .fn()
        .mockResolvedValue({ createdAt: new Date('2026-01-01'), getEffectivePlan: jest.fn() })
    } as never,
    repository as never,
    { resolve: jest.fn().mockReturnValue({ available: true, accessReason: 'trial' }) },
    { resolve: jest.fn().mockReturnValue({ timezone: 'UTC', canExtractWellbeing: true }) },
    (overrides.agent ?? { respond: jest.fn() }) as never,
    (overrides.mood ?? { createFromGuidedCheckIn: jest.fn() }) as never,
    (overrides.sleep ?? { createFromGuidedCheckIn: jest.fn() }) as never,
    { dailyCheckInHandoff: jest.fn() } as never,
    {
      get: jest.fn((key: string) => (key === 'ai.extractionMinimumConfidence' ? 0.85 : 'secret'))
    } as never
  );
}

function repositoryFor(current: ReturnType<typeof session>) {
  return {
    findByUserAndDate: jest.fn().mockResolvedValue(current),
    claimAnswer: jest.fn().mockResolvedValue(current),
    finishTurn: jest.fn((input) =>
      Promise.resolve({
        ...current,
        state: input.state,
        status: input.completed ? 'completed' : 'in_progress',
        questionCount: input.questionCount,
        nextQuestion: input.nextQuestion,
        processedRequests: [{ id: input.requestId, fingerprint: input.fingerprint }]
      })
    ),
    releaseAnswer: jest.fn()
  };
}

describe('DailyCheckInService', () => {
  it('starts with free-text mood and exposes two principal steps', async () => {
    const repository = {
      start: jest.fn((input) =>
        Promise.resolve(
          session({
            questionCount: 1,
            maxQuestions: input.maxQuestions,
            nextQuestion: input.firstQuestion
          })
        )
      )
    };
    const result = await createService(repository).start('user-1', 'pt-BR');
    expect(repository.start).toHaveBeenCalledWith(expect.objectContaining({ maxQuestions: 2 }));
    expect(result).toMatchObject({ currentStep: 'mood', questionCount: 1, maxQuestions: 2 });
  });

  it('keeps mood as free text, processes it through the agent, then advances to structured sleep', async () => {
    const current = session();
    const repository = repositoryFor(current);
    const agent = {
      respond: jest.fn().mockResolvedValue({
        extracted: { mood: { score: 7, scoreConfidence: 0.95, note: 'Mais calmo.' } },
        nextQuestion: null,
        completed: true,
        requiresSafetyHandoff: false
      })
    };
    const result = await createService(repository, { agent }).answer({
      userId: 'user-1',
      locale: 'pt-BR',
      clientRequestId: '71e76882-e209-446d-8f21-17849cd8ac57',
      message: 'Hoje acordei mais calmo, mas um pouco cansado.'
    });
    expect(agent.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: 'Hoje acordei mais calmo, mas um pouco cansado.'
      })
    );
    expect(result).toMatchObject({ completed: false, currentStep: 'sleep', nextQuestion: null });
    expect(repository.finishTurn).toHaveBeenCalledWith(
      expect.objectContaining({ completed: false, nextQuestion: null })
    );
  });

  it('asks one mood follow-up when extraction remains ambiguous', async () => {
    const current = session();
    const repository = repositoryFor(current);
    const result = await createService(repository, {
      agent: {
        respond: jest.fn().mockResolvedValue({
          extracted: { mood: null },
          nextQuestion: null,
          completed: false,
          requiresSafetyHandoff: false
        })
      }
    }).answer({
      userId: 'user-1',
      locale: 'pt-BR',
      clientRequestId: 'ddda0b32-2915-45dc-b2f4-17b287e87aa1',
      message: 'Não sei.'
    });
    expect(result).toMatchObject({ currentStep: 'mood', questionCount: 2 });
    expect(result.nextQuestion).toContain('estado de hoje');
  });

  it('persists mood and structured sleep together when the sleep step is submitted', async () => {
    const current = session({
      questionCount: 1,
      nextQuestion: null,
      state: {
        ...structuredClone(EMPTY_CHECK_IN_STATE),
        mood: { score: 7, scoreConfidence: 0.95, note: 'Mais calmo.' }
      }
    });
    const repository = repositoryFor(current);
    const mood = { createFromGuidedCheckIn: jest.fn().mockResolvedValue({ id: 'mood-1' }) };
    const sleep = { createFromGuidedCheckIn: jest.fn().mockResolvedValue({ id: 'sleep-1' }) };
    const result = await createService(repository, { mood, sleep }).submitSleep({
      userId: 'user-1',
      locale: 'pt-BR',
      clientRequestId: '6ef4ed56-b54a-4bd8-821c-54be2a762c6a',
      recordDate: '2026-08-16',
      durationMinutes: 450,
      wakeRestfulness: 'fairly_rested',
      awakeTimeDuringNight: '15_to_29',
      note: 'Choveu durante a noite.'
    });
    expect(mood.createFromGuidedCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        localDate: '2026-08-17',
        sourceEventId: 'daily-check-in:check-in-1:mood'
      })
    );
    expect(sleep.createFromGuidedCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        localDate: '2026-08-16',
        sourceEventId: 'daily-check-in:check-in-1:sleep',
        data: {
          durationMinutes: 450,
          wakeRestfulness: 'fairly_rested',
          awakeTimeDuringNight: '15_to_29',
          note: 'Choveu durante a noite.'
        }
      })
    );
    expect(result).toMatchObject({ completed: true, currentStep: 'completed' });
    expect(repository.finishTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: true,
        moodRecordId: 'mood-1',
        sleepRecordId: 'sleep-1'
      })
    );
  });

  it('preserves continue later for both steps', async () => {
    const current = session({ nextQuestion: null });
    const dismissed = { ...current, dismissedAt: new Date() };
    const repository = {
      start: jest.fn().mockResolvedValue(current),
      dismissToday: jest.fn().mockResolvedValue(dismissed)
    };
    await expect(createService(repository).dismiss('user-1', 'pt-BR')).resolves.toMatchObject({
      dismissedToday: true,
      inProgress: true,
      currentStep: 'sleep'
    });
  });
});
