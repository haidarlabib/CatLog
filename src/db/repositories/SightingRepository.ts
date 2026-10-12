import { ProwlLogDatabase, db as defaultDb, generateId, currentTimestamp } from '../database';
import { ValidationError, NotFoundError, RelationError, DatabaseError } from '../errors';
import type { Sighting, CreateSightingInput, UpdateSightingInput } from '../../types';

export class SightingRepository {
  private db: ProwlLogDatabase;

  constructor(db: ProwlLogDatabase = defaultDb) {
    this.db = db;
  }

  /**
   * Create a new sighting record.
   * Validates that the referenced catId exists.
   */
  async create(input: CreateSightingInput): Promise<Sighting> {
    if (!input.catId || typeof input.catId !== 'string') {
      throw new ValidationError('A valid catId is required for creating a sighting.', 'catId');
    }

    // Verify cat exists
    const cat = await this.db.cats.get(input.catId);
    if (!cat) {
      throw new RelationError(`Cannot create sighting: Referenced cat with ID "${input.catId}" does not exist.`);
    }

    // Validate coordinates if provided
    if (input.latitude !== undefined && input.latitude !== null && (isNaN(input.latitude) || input.latitude < -90 || input.latitude > 90)) {
      throw new ValidationError('Latitude must be a valid number between -90 and 90.', 'latitude');
    }
    if (input.longitude !== undefined && input.longitude !== null && (isNaN(input.longitude) || input.longitude < -180 || input.longitude > 180)) {
      throw new ValidationError('Longitude must be a valid number between -180 and 180.', 'longitude');
    }

    try {
      const now = currentTimestamp();
      const newSighting: Sighting = {
        id: generateId(),
        catId: input.catId,
        photoId: input.photoId ?? null,
        latitude: input.latitude !== undefined ? input.latitude : null,
        longitude: input.longitude !== undefined ? input.longitude : null,
        locationName: input.locationName?.trim() || null,
        notes: input.notes?.trim() || undefined,
        spottedAt: input.spottedAt || now,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.sightings.add(newSighting);
      return newSighting;
    } catch (err) {
      if (err instanceof ValidationError || err instanceof RelationError) throw err;
      throw new DatabaseError('Failed to create sighting record.', err);
    }
  }

  /**
   * Get sighting by ID
   */
  async getById(id: string): Promise<Sighting | null> {
    if (!id) return null;
    try {
      const sighting = await this.db.sightings.get(id);
      return sighting || null;
    } catch (err) {
      throw new DatabaseError(`Failed to fetch sighting with ID "${id}".`, err);
    }
  }

  /**
   * Get all sightings for a specific cat, ordered from newest to oldest
   */
  async getByCatId(catId: string): Promise<Sighting[]> {
    if (!catId) return [];
    try {
      return await this.db.sightings
        .where('catId')
        .equals(catId)
        .reverse()
        .sortBy('spottedAt');
    } catch (err) {
      throw new DatabaseError(`Failed to fetch sightings for cat "${catId}".`, err);
    }
  }

  /**
   * Get all sightings with valid coordinates for the Map view
   */
  async getAllWithCoordinates(): Promise<Sighting[]> {
    try {
      const all = await this.db.sightings.toArray();
      return all.filter(
        (s) => s.latitude !== null && s.longitude !== null && !isNaN(s.latitude) && !isNaN(s.longitude)
      );
    } catch (err) {
      throw new DatabaseError('Failed to fetch sightings with coordinates for Map.', err);
    }
  }

  /**
   * Get total sightings count
   */
  async count(): Promise<number> {
    try {
      return await this.db.sightings.count();
    } catch (err) {
      throw new DatabaseError('Failed to count sightings.', err);
    }
  }

  /**
   * Update sighting record
   */
  async update(id: string, input: UpdateSightingInput): Promise<Sighting> {
    if (!id) throw new ValidationError('Sighting ID is required for update.', 'id');

    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError('Sighting', id);
    }

    try {
      const updatedFields: Partial<Sighting> = {
        updatedAt: currentTimestamp(),
      };

      if (input.photoId !== undefined) {
        updatedFields.photoId = input.photoId;
      }
      if (input.latitude !== undefined) {
        if (input.latitude !== null && (isNaN(input.latitude) || input.latitude < -90 || input.latitude > 90)) {
          throw new ValidationError('Latitude must be a valid number between -90 and 90.', 'latitude');
        }
        updatedFields.latitude = input.latitude;
      }
      if (input.longitude !== undefined) {
        if (input.longitude !== null && (isNaN(input.longitude) || input.longitude < -180 || input.longitude > 180)) {
          throw new ValidationError('Longitude must be a valid number between -180 and 180.', 'longitude');
        }
        updatedFields.longitude = input.longitude;
      }
      if (input.locationName !== undefined) {
        updatedFields.locationName = input.locationName?.trim() || null;
      }
      if (input.notes !== undefined) {
        updatedFields.notes = input.notes.trim();
      }
      if (input.spottedAt !== undefined) {
        updatedFields.spottedAt = input.spottedAt;
      }

      await this.db.sightings.update(id, updatedFields);
      return { ...existing, ...updatedFields };
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw err;
      throw new DatabaseError(`Failed to update sighting with ID "${id}".`, err);
    }
  }

  /**
   * Delete single sighting
   */
  async delete(id: string): Promise<void> {
    if (!id) throw new ValidationError('Sighting ID is required for delete.', 'id');

    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError('Sighting', id);
    }

    try {
      await this.db.transaction('rw', [this.db.sightings, this.db.photos], async () => {
        // Also remove photos associated with this sightingId
        const photoKeys = await this.db.photos
          .where('sightingId')
          .equals(id)
          .primaryKeys();
        if (photoKeys.length > 0) {
          await this.db.photos.bulkDelete(photoKeys);
        }
        await this.db.sightings.delete(id);
      });
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError(`Failed to delete sighting with ID "${id}".`, err);
    }
  }
}
