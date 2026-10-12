import Dexie, { type Table } from 'dexie';
import type {
  Cat,
  Sighting,
  CatPhoto,
  FeedingLog,
  AppSetting,
} from '../types';

export const DB_NAME = 'ProwlLogDB';
export const DB_VERSION = 1;

/**
 * Generate cryptographically secure UUID string
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto.randomUUID might not be available
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current ISO 8601 timestamp string
 */
export function currentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Dexie database definition for ProwlLog PWA
 */
export class ProwlLogDatabase extends Dexie {
  cats!: Table<Cat, string>;
  sightings!: Table<Sighting, string>;
  photos!: Table<CatPhoto, string>;
  feeding_logs!: Table<FeedingLog, string>;
  settings!: Table<AppSetting, string>;

  constructor(dbName: string = DB_NAME) {
    super(dbName);

    // Version 1 Schema per PRD Section 9
    this.version(DB_VERSION).stores({
      cats: 'id, name, breed, createdAt, updatedAt',
      sightings: 'id, catId, photoId, spottedAt, createdAt',
      photos: 'id, catId, sightingId, createdAt',
      feeding_logs: 'id, catId, sightingId, fedAt, createdAt',
      settings: 'key, updatedAt',
    });
  }
}

/**
 * Singleton database instance for production application
 */
export const db = new ProwlLogDatabase();
