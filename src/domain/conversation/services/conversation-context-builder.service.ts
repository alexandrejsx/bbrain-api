export interface ConversationContextBuilder {
  buildRecentContext(conversationId: string): Promise<ReadonlyArray<string>>;
}
