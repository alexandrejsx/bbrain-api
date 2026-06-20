import { UseCase } from '../use-case.interface';

export interface StartConversationInput {
  userId: string;
}

export interface StartConversationOutput {
  conversationId: string;
}

export type StartConversationUseCase = UseCase<StartConversationInput, StartConversationOutput>;

export interface ReceiveUserMessageInput {
  conversationId: string;
  userId: string;
  content: string;
}

export interface ReceiveUserMessageOutput {
  messageId: string;
}

export type ReceiveUserMessageUseCase = UseCase<ReceiveUserMessageInput, ReceiveUserMessageOutput>;

export interface AppendAssistantMessageInput {
  conversationId: string;
  content: string;
}

export interface AppendAssistantMessageOutput {
  messageId: string;
}

export type AppendAssistantMessageUseCase = UseCase<
  AppendAssistantMessageInput,
  AppendAssistantMessageOutput
>;

export interface GetConversationHistoryInput {
  conversationId: string;
  limit?: number;
}

export interface GetConversationHistoryOutput {
  messages: ReadonlyArray<Record<string, unknown>>;
}

export type GetConversationHistoryUseCase = UseCase<
  GetConversationHistoryInput,
  GetConversationHistoryOutput
>;

export interface CloseSessionInput {
  sessionId: string;
}

export interface CloseSessionOutput {
  closed: boolean;
}

export type CloseSessionUseCase = UseCase<CloseSessionInput, CloseSessionOutput>;
