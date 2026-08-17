import { SendChatMessageService } from '../send-chat-message.service';

describe('SendChatMessageService', () => {
  it('prioritizes the reply, updates the small recent window and only schedules post-processing', async () => {
    const context = {
      identity: { preferredName: 'Alex', preferredLanguage: 'pt-BR' },
      memories: [],
      patterns: [],
      recentMessages: [
        { id: 'old', role: 'user', content: 'Mensagem anterior', createdAt: '2026-08-14T11:00:00Z' }
      ]
    };
    const agent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Vamos olhar para isso juntos.',
        riskLevel: 'none',
        scopeStatus: 'in_scope',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 }
      })
    };
    const sessions = {
      appendExchange: jest.fn().mockResolvedValue(undefined),
      deleteSession: jest.fn()
    };
    const requests = {
      claim: jest.fn().mockResolvedValue('claimed'),
      complete: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    const usage = {
      assertCanSendMessage: jest.fn().mockResolvedValue({ id: 'reservation' }),
      registerReservedLlmUsage: jest.fn().mockResolvedValue(undefined),
      releaseMessageReservation: jest.fn()
    };
    const scheduler = { schedule: jest.fn() };
    const service = new SendChatMessageService(
      agent as never,
      {
        build: jest.fn().mockResolvedValue({
          profileConfigured: true,
          context,
          consent: { canUseConversationData: true, timezone: 'America/Sao_Paulo' }
        })
      } as never,
      { apply: jest.fn(({ output }) => output) } as never,
      sessions as never,
      requests as never,
      usage as never,
      scheduler as never
    );

    const result = await service.execute({
      userId: 'user-1',
      conversationId: 'session-1',
      clientMessageId: 'event-1',
      message: 'Ainda estou preocupado.'
    });

    expect(agent.respond).toHaveBeenCalledWith(expect.objectContaining({ context }));
    expect(sessions.appendExchange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceEventId: 'event-1', userMessage: 'Ainda estou preocupado.' })
    );
    expect(scheduler.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ sourceEventId: 'event-1', assistantReply: result.reply })
    );
    expect(result.reply).toBe('Vamos olhar para isso juntos.');
  });
});
