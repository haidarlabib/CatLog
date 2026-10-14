import { ProwlLogDatabase, db as defaultDb, generateId, currentTimestamp } from '../database';
import { ValidationError, NotFoundError, DatabaseError } from '../errors';
import type { Cat, CatWithLatestSighting, CreateCatInput, UpdateCatInput } from '../../types';

export class CatRepository {
  private db: ProwlLogDatabase;

  constructor(db: ProwlLogDatabase = defaultDb) {
    this.db = db;
  }

  /**
   * Validate cat name
   */
  private validateName(name?: string): string {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Cat name is required and cannot be empty.', 'name');
    }
    return name.trim();
  }

  /**
   * Create a new cat profile
   */
  async create(input: CreateCatInput): Promise<Cat> {
    try {
      const trimmedName = this.validateName(input.name);
      const now = currentTimestamp();

      const newCat: Cat = {
        id: generateId(),
        name: trimmedName,
        breed: input.breed?.trim() || 'unknown',
        coatColors: input.coatColors || [],
        patterns: input.patterns || [],
        badgeRing: input.badgeRing || undefined,
        notes: input.notes?.trim() || undefined,
        coverPhotoId: input.coverPhotoId || null,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.cats.add(newCat);
      return newCat;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new DatabaseError('Failed to create cat record in local database.', err);
    }
  }

  /**
   * Get cat by ID
   */
  async getById(id: string): Promise<Cat | null> {
    if (!id || typeof id !== 'string') return null;
    try {
      const cat = await this.db.cats.get(id);
      return cat || null;
    } catch (err) {
      throw new DatabaseError(`Failed to fetch cat with ID "${id}".`, err);
    }
  }

  /**
   * Get all cats sorted by last updated timestamp
   */
  async getAll(): Promise<Cat[]> {
    try {
      return await this.db.cats.orderBy('updatedAt').reverse().toArray();
    } catch (err) {
      throw new DatabaseError('Failed to fetch cats from local database.', err);
    }
  }

  /**
   * Count total unique cats
   */
  async count(): Promise<number> {
    try {
      return await this.db.cats.count();
    } catch (err) {
      throw new DatabaseError('Failed to count cats.', err);
    }
  }

  /**
   * Search cats by name, breed, or color
   */
  async search(query: string): Promise<Cat[]> {
    try {
      const clean = query.trim().toLowerCase();
      if (!clean) return await this.getAll();

      return await this.db.cats
        .filter((cat) => {
          const matchName = cat.name.toLowerCase().includes(clean);
          const matchBreed = cat.breed?.toLowerCase().includes(clean) ?? false;
          const matchColors = cat.coatColors?.some((c) => c.toLowerCase().includes(clean)) ?? false;
          const matchPatterns = cat.patterns?.some((p) => p.toLowerCase().includes(clean)) ?? false;
          return matchName || matchBreed || matchColors || matchPatterns;
        })
        .toArray();
    } catch (err) {
      throw new DatabaseError('Failed to search cats in local database.', err);
    }
  }

  /**
   * Update cat profile
   */
  async update(id: string, input: UpdateCatInput): Promise<Cat> {
    if (!id) throw new ValidationError('Cat ID is required for update.', 'id');

    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError('Cat', id);
    }

    try {
      const updatedFields: Partial<Cat> = {
        updatedAt: currentTimestamp(),
      };

      if (input.name !== undefined) {
        updatedFields.name = this.validateName(input.name);
      }
      if (input.breed !== undefined) {
        updatedFields.breed = input.breed.trim() || 'unknown';
      }
      if (input.coatColors !== undefined) {
        updatedFields.coatColors = input.coatColors;
      }
      if (input.patterns !== undefined) {
        updatedFields.patterns = input.patterns;
      }
      if (input.badgeRing !== undefined) {
        updatedFields.badgeRing = input.badgeRing;
      }
      if (input.notes !== undefined) {
        updatedFields.notes = input.notes.trim();
      }
      if (input.coverPhotoId !== undefined) {
        updatedFields.coverPhotoId = input.coverPhotoId;
      }

      await this.db.cats.update(id, updatedFields);
      return { ...existing, ...updatedFields };
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw err;
      throw new DatabaseError(`Failed to update cat with ID "${id}".`, err);
    }
  }

  /**
   * Delete cat with cascade deletion of sightings, photos, and feeding logs
   * Uses an atomic ACID Dexie transaction.
   */
  async deleteWithCascade(id: string): Promise<void> {
    if (!id) throw new ValidationError('Cat ID is required for delete.', 'id');

    const cat = await this.getById(id);
    if (!cat) {
      throw new NotFoundError('Cat', id);
    }

    try {
      await this.db.transaction(
        'rw',
        [this.db.cats, this.db.sightings, this.db.photos, this.db.feeding_logs],
        async () => {
          // 1. Delete associated feeding logs
          const feedingLogKeys = await this.db.feeding_logs
            .where('catId')
            .equals(id)
            .primaryKeys();
          if (feedingLogKeys.length > 0) {
            await this.db.feeding_logs.bulkDelete(feedingLogKeys);
          }

          // 2. Delete associated photos
          const photoKeys = await this.db.photos
            .where('catId')
            .equals(id)
            .primaryKeys();
          if (photoKeys.length > 0) {
            await this.db.photos.bulkDelete(photoKeys);
          }

          // 3. Delete associated sightings
          const sightingKeys = await this.db.sightings
            .where('catId')
            .equals(id)
            .primaryKeys();
          if (sightingKeys.length > 0) {
            await this.db.sightings.bulkDelete(sightingKeys);
          }

          // 4. Delete the cat record itself
          await this.db.cats.delete(id);
        }
      );
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError(`Failed to cascade delete cat with ID "${id}".`, err);
    }
  }

  /**
   * Get cat profile with aggregated sightings count and latest sighting
   */
  async getCatWithLatestSighting(id: string): Promise<CatWithLatestSighting | null> {
    const cat = await this.getById(id);
    if (!cat) return null;

    try {
      const sightings = await this.db.sightings
        .where('catId')
        .equals(id)
        .toArray();

      sightings.sort(
        (a, b) => (new Date(b.spottedAt).getTime() || 0) - (new Date(a.spottedAt).getTime() || 0)
      );

      const latestSighting = sightings.length > 0 ? sightings[0] : null;

      return {
        ...cat,
        latestSighting,
        sightingsCount: sightings.length,
      };
    } catch (err) {
      throw new DatabaseError(`Failed to fetch latest sighting for cat "${id}".`, err);
    }
  }
}
