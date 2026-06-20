import { Document, FilterQuery, UpdateQuery } from 'mongoose';

export type MongoDocument = Document<unknown, any, any>;

export interface PaginateResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IGenericRepository<T extends MongoDocument> {
  add(entity: Partial<T>): Promise<T>;

  insertMany(entities: Partial<T>[]): Promise<T[]>;

  findOne(conditions: string | FilterQuery<T>): Promise<T | null>;

  findAll(conditions?: FilterQuery<T>, sort?: Record<string, 1 | -1>, limit?: number): Promise<T[]>;

  findByConditions(
    match: FilterQuery<T>,
    sort?: Record<string, 1 | -1>,
    limit?: number
  ): Promise<T[]>;

  aggregate<TResult = unknown>(pipeline: object[]): Promise<TResult[]>;

  paginateByConditions(
    match: FilterQuery<T>,
    page: number,
    limit: number,
    sort?: Record<string, 1 | -1>
  ): Promise<PaginateResult<T>>;

  update(id: string, item: UpdateQuery<T>): Promise<T | null>;

  updateMany(
    conditions: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ matchedCount: number; modifiedCount: number }>;

  delete(id: string): Promise<boolean>;
}
