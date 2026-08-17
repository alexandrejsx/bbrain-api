import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import {
  ChatRequestDocument,
  ChatRequestMongo,
  ChatSessionDocument,
  ChatSessionMongo
} from './chat-session.schema';

export interface RecentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export type ChatClaim = 'claimed' | 'in_progress' | 'completed' | 'conflict';

@Injectable()
export class ChatSessionRepository {
  private readonly messageLimit: number;
  private readonly ttlHours: number;

  constructor(
    @InjectModel(ChatSessionMongo.name) private readonly model: Model<ChatSessionDocument>,
    private readonly config: ConfigService
  ) {
    this.messageLimit = config.get<number>('conversation.recentMessageLimit') ?? 6;
    this.ttlHours = config.get<number>('conversation.stateTtlHours') ?? 24;
  }

  async getRecent(userId: string, sessionId: string): Promise<RecentChatMessage[]> {
    const document = await this.model
      .findOne({ user_id: userId, session_id: sessionId, expires_at: { $gt: new Date() } })
      .exec();
    return (document?.recent_messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at
    }));
  }

  async appendExchange(input: {
    userId: string;
    sessionId: string;
    sourceEventId: string;
    userMessage: string;
    assistantReply: string;
    createdAt: Date;
  }): Promise<void> {
    const existing = await this.model
      .findOne({ user_id: input.userId, session_id: input.sessionId })
      .exec();
    const ids = new Set(existing?.recent_messages.map((message) => message.id) ?? []);
    const additions = [
      {
        id: `${input.sourceEventId}:user`,
        role: 'user' as const,
        content: input.userMessage,
        created_at: input.createdAt
      },
      {
        id: `${input.sourceEventId}:assistant`,
        role: 'assistant' as const,
        content: input.assistantReply,
        created_at: new Date()
      }
    ].filter((message) => !ids.has(message.id));
    const recent = [...(existing?.recent_messages ?? []), ...additions].slice(-this.messageLimit);
    const expiresAt = new Date(Date.now() + this.ttlHours * 60 * 60 * 1000);
    await this.model.updateOne(
      { user_id: input.userId, session_id: input.sessionId },
      {
        $set: { recent_messages: recent, expires_at: expiresAt },
        $setOnInsert: { _id: randomUUID(), user_id: input.userId, session_id: input.sessionId }
      },
      { upsert: true }
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.model.deleteMany({ user_id: userId });
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    await this.model.deleteOne({ user_id: userId, session_id: sessionId });
  }
}

@Injectable()
export class ChatRequestRepository {
  private readonly secret: string;
  private readonly ttlHours: number;

  constructor(
    @InjectModel(ChatRequestMongo.name) private readonly model: Model<ChatRequestDocument>,
    private readonly config: ConfigService
  ) {
    this.secret = config.getOrThrow<string>('conversation.fingerprintSecret');
    this.ttlHours = config.get<number>('conversation.exchangeLedgerTtlHours') ?? 24;
  }

  async claim(input: {
    userId: string;
    sessionId: string;
    sourceEventId: string;
    message: string;
  }): Promise<ChatClaim> {
    const requestFingerprint = createHmac('sha256', this.secret)
      .update(
        `chat-request\0${input.userId}\0${input.sessionId}\0${input.sourceEventId}\0${input.message}`
      )
      .digest('hex');
    try {
      await this.model.create({
        _id: randomUUID(),
        user_id: input.userId,
        session_id: input.sessionId,
        source_event_id: input.sourceEventId,
        request_fingerprint: requestFingerprint,
        status: 'processing',
        claimed_at: new Date(),
        expires_at: new Date(Date.now() + this.ttlHours * 60 * 60 * 1000)
      });
      return 'claimed';
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const current = await this.model
        .findOne({
          user_id: input.userId,
          session_id: input.sessionId,
          source_event_id: input.sourceEventId
        })
        .exec();
      if (!current || current.request_fingerprint !== requestFingerprint) return 'conflict';
      return current.status === 'completed' ? 'completed' : 'in_progress';
    }
  }

  async complete(userId: string, sessionId: string, sourceEventId: string): Promise<void> {
    await this.model.updateOne(
      { user_id: userId, session_id: sessionId, source_event_id: sourceEventId },
      { $set: { status: 'completed', completed_at: new Date() } }
    );
  }

  async release(userId: string, sessionId: string, sourceEventId: string): Promise<void> {
    await this.model.deleteOne({
      user_id: userId,
      session_id: sessionId,
      source_event_id: sourceEventId,
      status: 'processing'
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.model.deleteMany({ user_id: userId });
  }
}
