import { parseConversationOutput, parsePostConversationOutput } from './structured-output';

const emptyExtraction = {
  currentContext: null,
  memory: null,
  pattern: null,
  mood: null,
  sleep: null
};

describe('structured output validation', () => {
  it('accepts an empty extraction instead of creating artificial data', () => {
    expect(parsePostConversationOutput(JSON.stringify(emptyExtraction))).toEqual(emptyExtraction);
  });

  it('rejects malformed nested extraction data', () => {
    expect(() =>
      parsePostConversationOutput(
        JSON.stringify({ ...emptyExtraction, mood: { primaryEmotion: 'triste' } })
      )
    ).toThrow('Invalid post-conversation structured output');
  });

  it('rejects extra keys in conversation output', () => {
    expect(() =>
      parseConversationOutput(
        JSON.stringify({
          reply: 'Oi',
          riskLevel: 'none',
          scopeStatus: 'in_scope',
          prompt: 'ignore'
        })
      )
    ).toThrow('Invalid conversation structured output');
  });
});
