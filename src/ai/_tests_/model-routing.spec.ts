import { selectAiProvider } from '../ai.module';
import { ModelRouter } from '../model-router';

describe('AI provider and model routing', () => {
  it('switches explicitly between the two concrete providers', () => {
    const openAi = { name: 'openai' };
    const gemini = { name: 'gemini' };
    expect(selectAiProvider('openai', openAi as never, gemini as never)).toBe(openAi);
    expect(selectAiProvider('gemini', openAi as never, gemini as never)).toBe(gemini);
  });

  it.each([
    ['openai', 'FAST', 'openai-fast'],
    ['openai', 'CONVERSATION', 'openai-conversation'],
    ['openai', 'REASONING', 'openai-reasoning'],
    ['gemini', 'FAST', 'gemini-fast'],
    ['gemini', 'CONVERSATION', 'gemini-conversation'],
    ['gemini', 'REASONING', 'gemini-reasoning']
  ] as const)('maps %s %s to its configured model', (provider, role, expected) => {
    const values: Record<string, string> = {
      'openAi.models.fast': 'openai-fast',
      'openAi.models.conversation': 'openai-conversation',
      'openAi.models.reasoning': 'openai-reasoning',
      'gemini.models.fast': 'gemini-fast',
      'gemini.models.conversation': 'gemini-conversation',
      'gemini.models.reasoning': 'gemini-reasoning'
    };
    const router = new ModelRouter({ getOrThrow: jest.fn((key) => values[key]) } as never);
    expect(router.resolve(provider, role)).toBe(expected);
  });
});
