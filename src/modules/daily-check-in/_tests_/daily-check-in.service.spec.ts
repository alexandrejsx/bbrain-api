import { DailyCheckInService } from '../daily-check-in.service';
import { EMPTY_CHECK_IN_STATE } from '../daily-check-in.types';

function session() {
  return {
    id: 'check-in-1',
    userId: 'user-1',
    localDate: '2026-08-17',
    timezone: 'UTC',
    locale: 'pt-BR' as const,
    status: 'in_progress' as const,
    questionCount: 5,
    maxQuestions: 5,
    state: structuredClone(EMPTY_CHECK_IN_STATE),
    nextQuestion: 'Quanto tempo você acha que dormiu?',
    processedRequests: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function createService(repository: object) {
  return new DailyCheckInService(
    {
      findById: jest.fn().mockResolvedValue({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        getEffectivePlan: jest.fn()
      })
    } as never,
    repository as never,
    { resolve: jest.fn().mockReturnValue({ available: true, accessReason: 'trial' }) },
    { resolve: jest.fn().mockReturnValue({ timezone: 'UTC', canExtractWellbeing: true }) },
    { respond: jest.fn() } as never,
    { createFromGuidedCheckIn: jest.fn() } as never,
    { createFromGuidedCheckIn: jest.fn() } as never,
    { dailyCheckInHandoff: jest.fn() } as never,
    { get: jest.fn() } as never
  );
}

describe('DailyCheckInService', () => {
  it('reports a day without a session as pending', async () => {
    const repository = { findByUserAndDate: jest.fn().mockResolvedValue(null) };

    await expect(createService(repository).getStatus('user-1')).resolves.toEqual(
      expect.objectContaining({
        completedToday: false,
        dismissedToday: false,
        inProgress: false
      })
    );
  });

  it('reports a completed check-in without making it eligible again', async () => {
    const completed = {
      ...session(),
      status: 'completed' as const,
      completedAt: new Date('2026-08-17T12:00:00.000Z')
    };
    const repository = { findByUserAndDate: jest.fn().mockResolvedValue(completed) };

    await expect(createService(repository).getStatus('user-1')).resolves.toEqual(
      expect.objectContaining({
        completedToday: true,
        completed: true,
        dismissedToday: false,
        inProgress: false
      })
    );
  });

  it('persists continue later in the daily session while keeping manual resumption available', async () => {
    const current = { ...session(), questionCount: 1 };
    const dismissed = {
      ...current,
      dismissedAt: new Date('2026-08-17T12:00:00.000Z')
    };
    const repository = {
      start: jest.fn().mockResolvedValue(current),
      dismissToday: jest.fn().mockResolvedValue(dismissed)
    };

    const result = await createService(repository).dismiss('user-1', 'pt-BR');

    expect(result).toEqual(
      expect.objectContaining({
        completedToday: false,
        dismissedToday: true,
        inProgress: true,
        nextQuestion: current.nextQuestion
      })
    );
    expect(repository.dismissToday).toHaveBeenCalledWith(current.id, expect.any(Date));
  });

  it('returns to pending on the next local day after continue later', async () => {
    jest.useFakeTimers();
    try {
      const dismissed = {
        ...session(),
        localDate: '2026-08-17',
        dismissedAt: new Date('2026-08-17T12:00:00.000Z')
      };
      const repository = {
        findByUserAndDate: jest.fn((_userId: string, localDate: string) =>
          Promise.resolve(localDate === '2026-08-17' ? dismissed : null)
        )
      };
      const service = createService(repository);

      jest.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
      await expect(service.getStatus('user-1')).resolves.toEqual(
        expect.objectContaining({ dismissedToday: true })
      );

      jest.setSystemTime(new Date('2026-08-18T12:00:00.000Z'));
      await expect(service.getStatus('user-1')).resolves.toEqual(
        expect.objectContaining({
          completedToday: false,
          dismissedToday: false,
          inProgress: false
        })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('discards low-confidence values, enforces the question limit, and persists accepted fields without chat quota', async () => {
    const current = session();
    const repository = {
      findByUserAndDate: jest.fn().mockResolvedValue(current),
      claimAnswer: jest.fn().mockResolvedValue(current),
      finishTurn: jest.fn().mockImplementation((input) =>
        Promise.resolve({
          ...current,
          status: input.completed ? 'completed' : 'in_progress',
          state: input.state,
          questionCount: input.questionCount,
          nextQuestion: input.nextQuestion
        })
      ),
      releaseAnswer: jest.fn()
    };
    const agent = {
      respond: jest.fn().mockResolvedValue({
        extracted: {
          mood: { score: 3, scoreConfidence: 0.7, note: null },
          sleep: {
            durationMinutes: 240,
            durationConfidence: 0.97,
            durationApproximate: true,
            subjectiveQualityScore: null,
            subjectiveQualityConfidence: null,
            awakeningsCount: null,
            awakeningsConfidence: null,
            awakeningsApproximate: false,
            multipleAwakenings: false,
            awakeDuringNightMinutes: null,
            awakeDuringNightConfidence: null,
            awakeDuringNightApproximate: false,
            restfulnessScore: 8,
            restfulnessConfidence: 0.91,
            note: null
          }
        },
        nextQuestion: 'Quer contar mais alguma coisa?',
        completed: false,
        requiresSafetyHandoff: false,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      })
    };
    const mood = { createFromGuidedCheckIn: jest.fn() };
    const sleep = {
      createFromGuidedCheckIn: jest.fn().mockResolvedValue({ id: 'sleep-1' })
    };
    const service = new DailyCheckInService(
      {
        findById: jest.fn().mockResolvedValue({
          createdAt: new Date(),
          getEffectivePlan: jest.fn()
        })
      } as never,
      repository as never,
      { resolve: jest.fn().mockReturnValue({ available: true, accessReason: 'trial' }) },
      {
        resolve: jest.fn().mockReturnValue({ timezone: 'UTC', canExtractWellbeing: true })
      },
      agent as never,
      mood as never,
      sleep as never,
      { dailyCheckInHandoff: jest.fn() } as never,
      {
        get: jest.fn((key: string) =>
          key === 'ai.extractionMinimumConfidence' ? 0.85 : 'fingerprint-secret'
        )
      } as never
    );

    const result = await service.answer({
      userId: 'user-1',
      locale: 'pt-BR',
      clientRequestId: 'f13f6cf5-614f-4bc2-b349-c45445a12018',
      message: 'Dormi umas quatro horas e acordei descansado.'
    });

    expect(mood.createFromGuidedCheckIn).not.toHaveBeenCalled();
    expect(sleep.createFromGuidedCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          durationMinutes: 240,
          durationApproximate: true,
          restfulnessScore: 8,
          subjectiveQualityScore: null
        })
      })
    );
    expect(result.completed).toBe(true);
    expect(repository.finishTurn).toHaveBeenCalledWith(
      expect.objectContaining({ completed: true, sleepRecordId: 'sleep-1' })
    );
    expect(agent.respond).toHaveBeenCalledWith(
      expect.objectContaining({ currentQuestion: 'Quanto tempo você acha que dormiu?' })
    );
  });
});
