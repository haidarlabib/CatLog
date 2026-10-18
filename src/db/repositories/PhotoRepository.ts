import { ProwlLogDatabase, db as defaultDb, generateId, currentTimestamp } from '../database';
import { ValidationError, NotFoundError, RelationError, StorageQuotaError, DatabaseError } from '../errors';
import type { CatPhoto, SavePhotoInput } from '../../types';

export class PhotoRepository {
  private db: ProwlLogDatabase;

  constructor(db: ProwlLogDatabase = defaultDb) {
    this.db = db;
  }

  /**
   * Save a photo directly as a Blob in IndexedDB.
   * Validates cat relation and catches QuotaExceededError.
   */
  async save(input: SavePhotoInput): Promise<CatPhoto> {
    if (!input.catId) {
      throw new ValidationError('A valid catId is required to save a photo.', 'catId');
    }

    if (!input.blob || !(input.blob instanceof Blob)) {
      throw new ValidationError('A valid image Blob or File object is required.', 'blob');
    }

    if (!input.mimeType || !input.mimeType.startsWith('image/')) {
      throw new ValidationError('Invalid image mimeType. Must start with "image/".', 'mimeType');
    }

    // Verify cat exists
    const cat = await this.db.cats.get(input.catId);
    if (!cat) {
      throw new RelationError(`Cannot save photo: Referenced cat with ID "${input.catId}" does not exist.`);
    }

    try {
      const now = currentTimestamp();
      const photo: CatPhoto = {
        id: generateId(),
        catId: input.catId,
        sightingId: input.sightingId || null,
        blob: input.blob,
        mimeType: input.mimeType,
        width: input.width || null,
        height: input.height || null,
        focalX: input.focalX ?? 0.5,
        focalY: input.focalY ?? 0.5,
        zoom: input.zoom ?? 1.0,
        latitude: input.latitude !== undefined ? input.latitude : null,
        longitude: input.longitude !== undefined ? input.longitude : null,
        createdAt: now,
      };

      await this.db.photos.add(photo);
      return photo;
    } catch (err: unknown) {
      // Check for quota exceeded
      const isQuota =
        (err instanceof DOMException && err.name === 'QuotaExceededError') ||
        (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'QuotaExceededError') ||
        (err instanceof Error && /quota/i.test(err.message));

      if (isQuota) {
        throw new StorageQuotaError(
          'Device storage quota exceeded while saving image. Please remove older photos or free device space.',
          err
        );
      }

      if (err instanceof ValidationError || err instanceof RelationError) throw err;
      throw new DatabaseError('Failed to save photo Blob in local database.', err);
    }
  }

  /**
   * Retrieve photo by ID
   */
  async getById(id: string): Promise<CatPhoto | null> {
    if (!id) return null;
    try {
      const photo = await this.db.photos.get(id);
      return photo || null;
    } catch (err) {
      throw new DatabaseError(`Failed to fetch photo with ID "${id}".`, err);
    }
  }

  /**
   * Get all photos for a specific cat
   */
  async getByCatId(catId: string): Promise<CatPhoto[]> {
    if (!catId) return [];
    try {
      return await this.db.photos
        .where('catId')
        .equals(catId)
        .reverse()
        .sortBy('createdAt');
    } catch (err) {
      throw new DatabaseError(`Failed to fetch photos for cat "${catId}".`, err);
    }
  }

  /**
   * Get photo associated with a specific sighting
   */
  async getBySightingId(sightingId: string): Promise<CatPhoto | null> {
    if (!sightingId) return null;
    try {
      const photo = await this.db.photos
        .where('sightingId')
        .equals(sightingId)
        .first();
      return photo || null;
    } catch (err) {
      throw new DatabaseError(`Failed to fetch photo for sighting "${sightingId}".`, err);
    }
  }

  /**
   * Delete a photo by ID
   */
  async delete(id: string): Promise<void> {
    if (!id) throw new ValidationError('Photo ID is required for delete.', 'id');

    const photo = await this.getById(id);
    if (!photo) {
      throw new NotFoundError('Photo', id);
    }

    try {
      await this.db.photos.delete(id);
      this.revokeBlobUrl(id);
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError(`Failed to delete photo with ID "${id}".`, err);
    }
  }

  /**
   * Update crop focal coordinates and zoom on an existing photo
   */
  async updateCrop(
    id: string,
    crop: { focalX?: number | null; focalY?: number | null; zoom?: number | null }
  ): Promise<CatPhoto> {
    const photo = await this.getById(id);
    if (!photo) {
      throw new NotFoundError('Photo', id);
    }

    const updatedFields: Partial<CatPhoto> = {};
    if (crop.focalX !== undefined) updatedFields.focalX = crop.focalX;
    if (crop.focalY !== undefined) updatedFields.focalY = crop.focalY;
    if (crop.zoom !== undefined) updatedFields.zoom = crop.zoom;

    await this.db.photos.update(id, updatedFields);
    return { ...photo, ...updatedFields };
  }

  private blobUrlCache = new Map<string, string>();

  /**
   * Utility helper to create or retrieve transient object URL for image rendering
   */
  createBlobUrl(photo: CatPhoto): string {
    if (!photo.blob) return '';
    const cached = this.blobUrlCache.get(photo.id);
    if (cached) return cached;
    if (typeof URL === 'undefined' || !URL.createObjectURL) return '';
    const url = URL.createObjectURL(photo.blob);
    this.blobUrlCache.set(photo.id, url);
    return url;
  }

  /**
   * Revoke transient object URL to prevent memory leaks
   */
  revokeBlobUrl(urlOrId: string): void {
    if (!urlOrId) return;
    if (urlOrId.startsWith('blob:')) {
      for (const [id, url] of this.blobUrlCache.entries()) {
        if (url === urlOrId) {
          this.blobUrlCache.delete(id);
          break;
        }
      }
      try {
        URL.revokeObjectURL(urlOrId);
      } catch {
        // Safe ignore
      }
    } else {
      const url = this.blobUrlCache.get(urlOrId);
      if (url) {
        this.blobUrlCache.delete(urlOrId);
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Safe ignore
        }
      }
    }
  }
}
