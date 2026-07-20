import {
  buildBbrainSystemMessage,
  buildChatMessages,
  buildUserContextMessage
} from './bbrain-chat-prompt.renderer';

describe('bbrain chat prompt renderer', () => {
  it('includes explicit guidance for natural gender-neutral language in Portuguese', () => {
    const message = buildBbrainSystemMessage();

    expect(message.role).toBe('system');
    expect(message.content).toContain('GRAMMATICAL_GENDER_POLICY:');
    expect(message.content).toContain(
      'Não presumir gênero gramatical do usuário com base em sexo, nome, perfil, aparência ou qualquer inferência fraca.'
    );
    expect(message.content).toContain(
      'Preferir linguagem neutra natural em português sempre que possível.'
    );
    expect(message.content).toContain(
      'Se o usuário usar explicitamente uma forma de gênero na mensagem atual, você pode acompanhar essa forma apenas nesta resposta local.'
    );
    expect(message.content).toContain('Se houver qualquer ambiguidade, usar formulações neutras.');
  });

  it('keeps preferredName usage without turning profile context into grammatical gender inference', () => {
    const message = buildUserContextMessage({
      message: 'estou cansado',
      responseLanguage: 'pt-BR',
      context: {
        userIdentityContext: {
          displayName: 'Alex',
          preferredLanguage: 'pt-BR'
        },
        userProfileSummary: {}
      }
    });

    expect(message.role).toBe('system');
    expect(message.content).toContain(
      'Se houver userIdentityContext.displayName, use esse nome ao se dirigir ao usuário.'
    );
    expect(message.content).toContain(
      'Não use sexo, nome ou perfil para inferir concordância de gênero na resposta.'
    );
    expect(message.content).toContain('"displayName": "Alex"');
    expect(message.content).not.toContain('"sex"');
  });

  it('uses the configured profile language as the source of truth for the reply language', () => {
    const message = buildBbrainSystemMessage({
      message: 'hello',
      preferredLanguage: 'pt-BR',
      responseLanguage: 'pt-BR',
      context: {
        userProfileSummary: {}
      }
    });

    expect(message.content).toContain('Preferred app/profile language: pt-BR.');
    expect(message.content).toContain(
      'The configured app/profile language is the source of truth for the user-facing reply.'
    );
    expect(message.content).not.toContain('Detected current message language:');
    expect(message.content).not.toContain(
      'The current user message language has priority over profile language when clearly detected.'
    );
  });

  it('instructs the agent to interpret short replies from the previous turn', () => {
    const message = buildBbrainSystemMessage();

    expect(message.content).toContain('SHORT_REPLY_CONTINUITY:');
    expect(message.content).toContain(
      'Interpretar respostas curtas somente com base no conversationState estruturado e na mensagem atual.'
    );
    expect(message.content).toContain(
      'Não repetir a mesma pergunta quando o usuário já respondeu.'
    );
  });

  it('sends only structured state and the current user message, never transcript messages', () => {
    const messages = buildChatMessages({
      message: 'os dois',
      preferredLanguage: 'pt-BR',
      responseLanguage: 'pt-BR',
      context: {
        userProfileSummary: {},
        conversationState: {
          currentTopic: 'cansaço',
          currentConcerns: [],
          userNeeds: [],
          supportContext: 'unknown',
          safetyState: 'none',
          pendingQuestionCode: 'clarification',
          lastAssistantIntent: 'explore_impact'
        }
      }
    });

    expect(messages).toHaveLength(3);
    expect(messages[1].content).toContain('"pendingQuestionCode": "clarification"');
    expect(messages[2]).toEqual({ role: 'user', content: 'os dois' });
    expect(messages.some((message) => message.role === 'assistant')).toBe(false);
  });
});
