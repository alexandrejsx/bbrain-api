import { DailyCheckInAgent } from '../daily-check-in-agent';

describe('DailyCheckInAgent', () => {
  it('uses FAST and returns only the free-text mood extraction', async () => {
    const ai = {
      generate: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          extracted: { mood: { score: 8, scoreConfidence: 0.94, note: 'Mais tranquilo.' } },
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
      missingFields: ['mood'],
      currentQuestion: 'Como você está se sentindo hoje?',
      questionCount: 1,
      maxQuestions: 2,
      userMessage: 'Estou mais tranquilo hoje.',
      correlationId: 'request-1'
    });
    expect(result.extracted).toEqual({
      mood: { score: 8, scoreConfidence: 0.94, note: 'Mais tranquilo.' }
    });
    expect(ai.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'daily_check_in.answer',
        role: 'FAST',
        outputSchemaName: 'bbrain_daily_check_in'
      })
    );
  });

  it('rejects legacy sleep extraction fields from structured output', async () => {
    const ai = {
      generate: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          extracted: { mood: null, sleep: { durationMinutes: 420 } },
          nextQuestion: null,
          completed: true,
          requiresSafetyHandoff: false
        }),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      })
    };
    await expect(
      new DailyCheckInAgent(ai as never).respond({
        locale: 'pt-BR',
        currentState: {},
        missingFields: ['mood'],
        currentQuestion: null,
        questionCount: 2,
        maxQuestions: 2,
        userMessage: 'Dormi sete horas.',
        correlationId: 'request-2'
      })
    ).rejects.toThrow('Invalid daily check-in structured output');
  });
});
