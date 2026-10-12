export * from './database';
export * from './errors';
export * from './repositories/CatRepository';
export * from './repositories/SightingRepository';
export * from './repositories/PhotoRepository';
export * from './repositories/FeedingLogRepository';
export * from './repositories/SettingsRepository';

import { CatRepository } from './repositories/CatRepository';
import { SightingRepository } from './repositories/SightingRepository';
import { PhotoRepository } from './repositories/PhotoRepository';
import { FeedingLogRepository } from './repositories/FeedingLogRepository';
import { SettingsRepository } from './repositories/SettingsRepository';

// Export default singleton instances bound to production DB
export const catRepository = new CatRepository();
export const sightingRepository = new SightingRepository();
export const photoRepository = new PhotoRepository();
export const feedingLogRepository = new FeedingLogRepository();
export const settingsRepository = new SettingsRepository();
