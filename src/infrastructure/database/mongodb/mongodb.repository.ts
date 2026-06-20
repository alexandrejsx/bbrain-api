import { Document, FilterQuery, Model, PipelineStage, UpdateQuery } from 'mongoose';
import { IGenericRepository, MongoDocument, PaginateResult } from './generic-repository';

export class MongodbRepository<T extends MongoDocument> implements IGenericRepository<T> {
  protected readonly _model: Model<T>;

  constructor(model: Model<T>) {
    this._model = model;
  }

  async add(entity: Partial<T>): Promise<T> {
    const createdEntity = new this._model(entity);
    return createdEntity.save() as Promise<T>;
  }

  async insertMany(entities: Partial<T>[]): Promise<T[]> {
    const docs = await this._model.insertMany(entities);
    return docs as unknown as T[];
  }

  async findOne(conditions: string | FilterQuery<T>): Promise<T | null> {
    if (typeof conditions === 'string') {
      return this._model.findById(conditions).exec();
    }

    return this._model.findOne(conditions).exec();
  }

  async findAll(
    conditions?: FilterQuery<T>,
    sort?: Record<string, 1 | -1>,
    limit?: number
  ): Promise<T[]> {
    let query = this._model.find(conditions || {});

    if (sort) {
      query = query.sort(sort);
    }

    if (limit) {
      query = query.limit(limit);
    }

    return query.exec();
  }

  async findByConditions(
    match: FilterQuery<T>,
    sort?: Record<string, 1 | -1>,
    limit?: number
  ): Promise<T[]> {
    const pipeline: PipelineStage[] = [{ $match: match }];

    if (sort) {
      pipeline.push({ $sort: sort });
    }

    if (limit) {
      pipeline.push({ $limit: limit });
    }

    return this._model.aggregate<T>(pipeline).exec();
  }

  async aggregate<TResult = unknown>(pipeline: PipelineStage[]): Promise<TResult[]> {
    return this._model.aggregate<TResult>(pipeline).exec();
  }

  async paginateByConditions(
    match: FilterQuery<T>,
    page: number,
    limit: number,
    sort?: Record<string, 1 | -1>
  ): Promise<PaginateResult<T>> {
    const skip = (page - 1) * limit;
    const pipeline: PipelineStage[] = [{ $match: match }];

    if (sort) {
      pipeline.push({ $sort: sort });
    }

    const dataPipeline: PipelineStage[] = [...pipeline, { $skip: skip }, { $limit: limit }];
    const total = await this._model.countDocuments(match).exec();
    const data = await this._model.aggregate<T>(dataPipeline).exec();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  async update(id: string, item: UpdateQuery<T>): Promise<T | null> {
    return this._model.findByIdAndUpdate(id, item, { new: true }).exec();
  }

  async updateMany(
    conditions: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const result = await this._model.updateMany(conditions, update).exec();
    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = await this._model.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
