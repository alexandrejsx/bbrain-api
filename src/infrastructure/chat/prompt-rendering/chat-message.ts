export type ChatMessageRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
};
