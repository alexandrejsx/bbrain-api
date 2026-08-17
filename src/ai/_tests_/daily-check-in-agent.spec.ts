import { DailyCheckInAgent } from '../daily-check-in-agent';

const emptySleep = {
  durationMinutes: null,
  durationConfidence: null,
  durationApproximate: false,
  subjectiveQualityScore: null,
  subjectiveQualityConfidence: null,
  awakeningsCount: null,
  awakeningsConfidence: null,
  awakeningsApproximate: false,
  multipleAwakenings: false,
  awakeDuringNightMinutes: null,
  awakeDuringNightConfidence: null,
  awakeDuringNightApproximate: false,
  restfulnessScore: null,
  restfulnessConfidence: null,
  note: null
};

describe('DailyCheckInAgent', () => {
  it('always uses the FAST model role through the provider-agnostic gateway', async () => {
    const ai = {
      generate: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          extracted: { mood: { score: 8, scoreConfidence: 0.94, note: null }, sleep: null },
          nextQuestion: 'E como foi sua noite?',
          completed: false,
          requiresSafetyHandoff: false
        }),
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }
      })
    };
    const agent = new DailyCheckInAgent(ai as never);
    await agent.respond({
      locale: 'pt-BR',
      currentState: {},
      missingFields: ['mood'],
      currentQuestion: 'Como você está se sentindo hoje?',
      questionCount: 1,
      maxQuestions: 5,
      userMessage: 'Estou me sentindo muito bem hoje.',
      correlationId: 'request-1'
    });
    expect(ai.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'daily_check_in.answer',
        role: 'FAST',
        outputSchemaName: 'bbrain_daily_check_in'
      })
    );
    expect(JSON.parse(ai.generate.mock.calls[0][0].messages[0].content)).toMatchObject({
      currentQuestion: 'Como você está se sentindo hoje?'
    });
  });

  it('preserves short approximate sleep and independent positive restfulness', async () => {
    const ai = {
      generate: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          extracted: {
            mood: null,
            sleep: {
              ...emptySleep,
              durationMinutes: 240,
              durationConfidence: 0.97,
              durationApproximate: true,
              restfulnessScore: 8,
              restfulnessConfidence: 0.9
            }
          },
          nextQuestion: null,
          completed: true,
          requiresSafetyHandoff: false
        }),
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }
      })
    };
    const result = await new DailyCheckInAgent(ai as never).respond({
      locale: 'pt-BR',
      currentState: {},
      missingFields: [],
      currentQuestion: 'Quanto tempo você acha que dormiu?',
      questionCount: 3,
      maxQuestions: 5,
      userMessage: 'Dormi umas quatro horas e acordei sem estar cansado.',
      correlationId: 'request-2'
    });
    expect(result.extracted.sleep).toEqual(
      expect.objectContaining({
        durationMinutes: 240,
        durationApproximate: true,
        restfulnessScore: 8,
        subjectiveQualityScore: null
      })
    );
  });

  it('keeps an unknown awakening count null instead of inventing precision', async () => {
    const ai = {
      generate: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          extracted: {
            mood: null,
            sleep: {
              ...emptySleep,
              awakeningsConfidence: 0.93,
              multipleAwakenings: true
            }
          },
          nextQuestion: 'Como você se sentiu ao acordar?',
          completed: false,
          requiresSafetyHandoff: false
        }),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      })
    };
    const result = await new DailyCheckInAgent(ai as never).respond({
      locale: 'pt-BR',
      currentState: {},
      missingFields: ['awakeningsCount'],
      currentQuestion: 'Você se lembra se acordou durante a noite?',
      questionCount: 2,
      maxQuestions: 5,
      userMessage: 'Acordei várias vezes.',
      correlationId: 'request-3'
    });
    expect(result.extracted.sleep?.awakeningsCount).toBeNull();
    expect(result.extracted.sleep?.multipleAwakenings).toBe(true);
  });
});
