import { ProwlLogDatabase, db as defaultDb, currentTimestamp } from '../database';
import { ValidationError, DatabaseError } from '../errors';
import type { AppSetting } from '../../types';

export class SettingsRepository {
  private db: ProwlLogDatabase;

  constructor(db: ProwlLogDatabase = defaultDb) {
    this.db = db;
  }

  /**
   * Get a setting by key
   */
  async get<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (!key) return defaultValue;
    try {
      const item = await this.db.settings.get(key);
      if (!item) return defaultValue;
      return item.value as T;
    } catch (err) {
      throw new DatabaseError(`Failed to fetch setting "${key}".`, err);
    }
  }

  /**
   * Set or update a setting value
   */
  async set<T = unknown>(key: string, value: T): Promise<AppSetting> {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new ValidationError('A non-empty setting key is required.', 'key');
    }

    try {
      const setting: AppSetting = {
        key: key.trim(),
        value,
        updatedAt: currentTimestamp(),
      };

      await this.db.settings.put(setting);
      return setting;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new DatabaseError(`Failed to save setting "${key}".`, err);
    }
  }

  /**
   * Get all stored settings
   */
  async getAll(): Promise<AppSetting[]> {
    try {
      return await this.db.settings.toArray();
    } catch (err) {
      throw new DatabaseError('Failed to fetch settings.', err);
    }
  }

  /**
   * Delete a setting by key
   */
  async delete(key: string): Promise<void> {
    if (!key) return;
    try {
      await this.db.settings.delete(key);
    } catch (err) {
      throw new DatabaseError(`Failed to delete setting "${key}".`, err);
    }
  }

  /**
   * Atomic reset of all tables (Reset Local Data feature)
   * Uses an atomic transaction across all five stores.
   */
  async clearAllData(): Promise<void> {
    try {
      await this.db.transaction(
        'rw',
        [this.db.cats, this.db.sightings, this.db.photos, this.db.feeding_logs, this.db.settings],
        async () => {
          await this.db.cats.clear();
          await this.db.sightings.clear();
          await this.db.photos.clear();
          await this.db.feeding_logs.clear();
          await this.db.settings.clear();
        }
      );
    } catch (err) {
      throw new DatabaseError('Failed to clear local database.', err);
    }
  }
}
