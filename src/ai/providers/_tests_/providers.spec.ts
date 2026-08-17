import { GeminiProvider } from '../gemini.provider';
import { OpenAiProvider } from '../openai.provider';

const request = {
  operation: 'conversation.reply' as const,
  role: 'CONVERSATION' as const,
  correlationId: 'run-1',
  systemPrompt: 'system',
  messages: [{ role: 'user' as const, content: 'oi' }],
  outputSchema: { type: 'object' },
  outputSchemaName: 'response',
  maxOutputTokens: 100,
  model: 'configured-model'
};

describe('concrete AI providers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calls OpenAI Responses with configured model, strict schema and disabled storage', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'configured-model',
          output_text: '{"reply":"oi"}',
          usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const provider = new OpenAiProvider({
      get: jest.fn((key: string) => ({ 'openAi.apiKey': 'key', 'openAi.timeoutMs': 1000 })[key])
    } as never);

    const result = await provider.generate(request);

    const openAiRequestBody = fetchMock.mock.calls[0][1]?.body;
    expect(typeof openAiRequestBody).toBe('string');
    const body = JSON.parse(openAiRequestBody as string);
    expect(body).toEqual(
      expect.objectContaining({ model: 'configured-model', store: false, instructions: 'system' })
    );
    expect(body.text.format).toEqual(
      expect.objectContaining({ type: 'json_schema', strict: true })
    );
    expect(result.usage.totalTokens).toBe(14);
  });

  it('calls Gemini with configured model and JSON schema', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          modelVersion: 'configured-model',
          candidates: [{ content: { parts: [{ text: '{"reply":"oi"}' }] } }],
          usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 3, totalTokenCount: 11 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const provider = new GeminiProvider({
      get: jest.fn((key: string) => ({ 'gemini.apiKey': 'key', 'gemini.timeoutMs': 1000 })[key])
    } as never);

    const result = await provider.generate(request);

    const geminiUrl = fetchMock.mock.calls[0][0];
    expect(typeof geminiUrl).toBe('string');
    expect(geminiUrl as string).toContain('/configured-model:generateContent');
    const geminiRequestBody = fetchMock.mock.calls[0][1]?.body;
    expect(typeof geminiRequestBody).toBe('string');
    const body = JSON.parse(geminiRequestBody as string);
    expect(body.generationConfig.responseJsonSchema).toEqual({ type: 'object' });
    expect(body.systemInstruction.parts[0].text).toBe('system');
    expect(result.usage.totalTokens).toBe(11);
  });

  it('uses minimal thinking for the FAST role', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          modelVersion: 'configured-model',
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
          usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 3, totalTokenCount: 11 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const provider = new GeminiProvider({
      get: jest.fn((key: string) => ({ 'gemini.apiKey': 'key', 'gemini.timeoutMs': 1000 })[key])
    } as never);

    await provider.generate({ ...request, operation: 'daily_check_in.answer', role: 'FAST' });

    const geminiRequestBody = fetchMock.mock.calls[0][1]?.body;
    expect(typeof geminiRequestBody).toBe('string');
    const body = JSON.parse(geminiRequestBody as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'MINIMAL' });
  });
});
