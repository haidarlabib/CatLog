import { ProwlLogDatabase, db as defaultDb, generateId, currentTimestamp } from '../database';
import { ValidationError, NotFoundError, RelationError, DatabaseError } from '../errors';
import type { FeedingLog, CreateFeedingLogInput, FoodType } from '../../types';

const VALID_FOOD_TYPES: FoodType[] = ['wet_food', 'dry_food', 'treat', 'other'];

export class FeedingLogRepository {
  private db: ProwlLogDatabase;

  constructor(db: ProwlLogDatabase = defaultDb) {
    this.db = db;
  }

  /**
   * Create a new feeding log
   */
  async create(input: CreateFeedingLogInput): Promise<FeedingLog> {
    if (!input.catId || typeof input.catId !== 'string') {
      throw new ValidationError('A valid catId is required for feeding logs.', 'catId');
    }

    if (!VALID_FOOD_TYPES.includes(input.foodType)) {
      throw new ValidationError(
        `Invalid foodType "${input.foodType}". Must be one of: ${VALID_FOOD_TYPES.join(', ')}.`,
        'foodType'
      );
    }

    // Verify cat exists
    const cat = await this.db.cats.get(input.catId);
    if (!cat) {
      throw new RelationError(`Cannot log feeding: Referenced cat with ID "${input.catId}" does not exist.`);
    }

    try {
      const now = currentTimestamp();
      const log: FeedingLog = {
        id: generateId(),
        catId: input.catId,
        sightingId: input.sightingId || null,
        foodType: input.foodType,
        notes: input.notes?.trim() || undefined,
        fedAt: input.fedAt || now,
        createdAt: now,
      };

      await this.db.feeding_logs.add(log);
      return log;
    } catch (err) {
      if (err instanceof ValidationError || err instanceof RelationError) throw err;
      throw new DatabaseError('Failed to record feeding log in local database.', err);
    }
  }

  /**
   * Get feeding log by ID
   */
  async getById(id: string): Promise<FeedingLog | null> {
    if (!id) return null;
    try {
      const log = await this.db.feeding_logs.get(id);
      return log || null;
    } catch (err) {
      throw new DatabaseError(`Failed to fetch feeding log with ID "${id}".`, err);
    }
  }

  /**
   * Get all feeding logs for a cat, sorted by newest fedAt timestamp
   */
  async getByCatId(catId: string): Promise<FeedingLog[]> {
    if (!catId) return [];
    try {
      return await this.db.feeding_logs
        .where('catId')
        .equals(catId)
        .reverse()
        .sortBy('fedAt');
    } catch (err) {
      throw new DatabaseError(`Failed to fetch feeding logs for cat "${catId}".`, err);
    }
  }

  /**
   * Delete a feeding log by ID
   */
  async delete(id: string): Promise<void> {
    if (!id) throw new ValidationError('Feeding log ID is required for delete.', 'id');

    const log = await this.getById(id);
    if (!log) {
      throw new NotFoundError('FeedingLog', id);
    }

    try {
      await this.db.feeding_logs.delete(id);
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError(`Failed to delete feeding log with ID "${id}".`, err);
    }
  }
}
