import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import { DailyCheckInDocument, DailyCheckInMongo } from './daily-check-in.schema';
import { DailyCheckInSession, DailyCheckInState, DailyCheckInLocale } from './daily-check-in.types';

function toSession(document: DailyCheckInDocument): DailyCheckInSession {
  return {
    id: document._id,
    userId: document.user_id,
    localDate: document.local_date,
    timezone: document.timezone,
    locale: document.locale as DailyCheckInLocale,
    status: document.status as DailyCheckInSession['status'],
    questionCount: document.question_count,
    maxQuestions: document.max_questions,
    state: document.state as unknown as DailyCheckInState,
    nextQuestion: document.next_question ?? null,
    processedRequests: document.processed_requests ?? [],
    processing: document.processing,
    moodRecordId: document.mood_record_id,
    sleepRecordId: document.sleep_record_id,
    dismissedAt: document.dismissed_at,
    completedAt: document.completed_at,
    createdAt: document.created_at,
    updatedAt: document.updated_at
  };
}

@Injectable()
export class DailyCheckInRepository {
  constructor(
    @InjectModel(DailyCheckInMongo.name)
    private readonly model: Model<DailyCheckInDocument>
  ) {}

  async findByUserAndDate(userId: string, localDate: string): Promise<DailyCheckInSession | null> {
    const document = await this.model.findOne({ user_id: userId, local_date: localDate }).exec();
    return document ? toSession(document) : null;
  }

  async start(input: {
    userId: string;
    localDate: string;
    timezone: string;
    locale: DailyCheckInLocale;
    state: DailyCheckInState;
    firstQuestion: string;
    maxQuestions: number;
  }): Promise<DailyCheckInSession> {
    try {
      const document = await this.model.findOneAndUpdate(
        { user_id: input.userId, local_date: input.localDate },
        {
          $setOnInsert: {
            _id: randomUUID(),
            user_id: input.userId,
            local_date: input.localDate,
            timezone: input.timezone,
            locale: input.locale,
            status: 'in_progress',
            question_count: 1,
            max_questions: input.maxQuestions,
            state: input.state,
            next_question: input.firstQuestion,
            processed_requests: []
          }
        },
        { upsert: true, new: true }
      );
      return toSession(document);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await this.findByUserAndDate(input.userId, input.localDate);
      if (!existing) throw error;
      return existing;
    }
  }

  async claimAnswer(
    sessionId: string,
    requestId: string,
    fingerprint: string
  ): Promise<DailyCheckInSession | null> {
    const document = await this.model.findOneAndUpdate(
      {
        _id: sessionId,
        status: 'in_progress',
        processing: { $exists: false },
        'processed_requests.id': { $ne: requestId }
      },
      { $set: { processing: { id: requestId, fingerprint } } },
      { new: true }
    );
    return document ? toSession(document) : null;
  }

  async finishTurn(input: {
    sessionId: string;
    requestId: string;
    fingerprint: string;
    state: DailyCheckInState;
    questionCount: number;
    nextQuestion: string | null;
    completed: boolean;
    moodRecordId?: string;
    sleepRecordId?: string;
    completedAt?: Date;
  }): Promise<DailyCheckInSession | null> {
    const set: Record<string, unknown> = {
      state: input.state,
      question_count: input.questionCount,
      status: input.completed ? 'completed' : 'in_progress'
    };
    if (input.nextQuestion) set.next_question = input.nextQuestion;
    if (input.moodRecordId) set.mood_record_id = input.moodRecordId;
    if (input.sleepRecordId) set.sleep_record_id = input.sleepRecordId;
    if (input.completedAt) set.completed_at = input.completedAt;

    const document = await this.model.findOneAndUpdate(
      { _id: input.sessionId, 'processing.id': input.requestId },
      {
        $set: set,
        $unset: {
          processing: 1,
          ...(input.nextQuestion ? {} : { next_question: 1 })
        },
        $push: {
          processed_requests: {
            $each: [{ id: input.requestId, fingerprint: input.fingerprint }],
            $slice: -5
          }
        }
      },
      { new: true }
    );
    return document ? toSession(document) : null;
  }

  async releaseAnswer(sessionId: string, requestId: string): Promise<void> {
    await this.model.updateOne(
      { _id: sessionId, 'processing.id': requestId },
      { $unset: { processing: 1 } }
    );
  }

  async dismissToday(sessionId: string, dismissedAt: Date): Promise<DailyCheckInSession | null> {
    const document = await this.model.findOneAndUpdate(
      { _id: sessionId, status: 'in_progress' },
      { $set: { dismissed_at: dismissedAt } },
      { new: true }
    );
    return document ? toSession(document) : null;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.model.deleteMany({ user_id: userId });
  }
}
