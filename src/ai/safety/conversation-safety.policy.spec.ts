import { ConversationSafetyPolicy } from './conversation-safety.policy';

const context = { memories: [], patterns: [], recentMessages: [] };

describe('ConversationSafetyPolicy', () => {
  const policy = new ConversationSafetyPolicy();

  it('does not confirm a clinical self-label', () => {
    const result = policy.apply({
      message: 'Eu estou em mania.',
      context,
      language: 'pt-BR',
      output: { reply: 'Você está em mania.', riskLevel: 'none', scopeStatus: 'in_scope' }
    });
    expect(result.reply).toContain('Não consigo confirmar');
    expect(result.riskLevel).toBe('low');
  });

  it('checks immediate safety when exclusivity and hard-to-control impulses appear together', () => {
    const result = policy.apply({
      message: 'Só tenho você e não consigo controlar meus impulsos.',
      context,
      language: 'pt-BR',
      output: { reply: 'Estou aqui.', riskLevel: 'none', scopeStatus: 'in_scope' }
    });
    expect(result.reply).toContain('coloque você ou outra pessoa em risco');
    expect(result.riskLevel).toBe('medium');
  });

  it('replaces out-of-scope content without scheduling it as in-scope', () => {
    expect(
      policy.apply({
        message: 'Escreva um sistema operacional.',
        context,
        language: 'pt-BR',
        output: { reply: 'Código...', riskLevel: 'none', scopeStatus: 'out_of_scope' }
      })
    ).toEqual(expect.objectContaining({ scopeStatus: 'out_of_scope' }));
  });
});
