import {
  ProwlLogDatabase,
  db as defaultDb,
  CatRepository,
  SightingRepository,
  PhotoRepository,
  FeedingLogRepository,
  ValidationError,
  NotFoundError,
  DatabaseError,
} from '../db';
import type {
  Cat,
  Sighting,
  CatPhoto,
  FeedingLog,
  FoodType,
} from '../types';

export interface CreateCatPhotoInput {
  blob: Blob;
  mimeType?: string;
  isCover?: boolean;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  zoom?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateCatFullInput {
  name: string;
  breed?: string;
  coatColors?: string[];
  patterns?: string[];
  badgeRing?: string;
  notes?: string;
  photos?: CreateCatPhotoInput[];
  photoBlob?: Blob | null;
  photoMimeType?: string;
  photoWidth?: number | null;
  photoHeight?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  zoom?: number | null;
  photoLatitude?: number | null;
  photoLongitude?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  sightingNotes?: string;
  spottedAt?: string;
  fedCat?: boolean;
  foodType?: FoodType;
  feedingNotes?: string;
}

export interface AddSightingFullInput {
  catId: string;
  photoBlob?: Blob | null;
  photoMimeType?: string;
  photoWidth?: number | null;
  photoHeight?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  zoom?: number | null;
  photoLatitude?: number | null;
  photoLongitude?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  notes?: string;
  spottedAt?: string;
  fedCat?: boolean;
  foodType?: FoodType;
  feedingNotes?: string;
  setAsCoverPhoto?: boolean;
}

export interface UpdateCatProfileInput {
  name?: string;
  breed?: string;
  coatColors?: string[];
  patterns?: string[];
  badgeRing?: string;
  notes?: string;
  newPhotoBlob?: Blob | null;
  newPhotoMimeType?: string;
  newPhotoWidth?: number | null;
  newPhotoHeight?: number | null;
  newPhotoFocalX?: number | null;
  newPhotoFocalY?: number | null;
  newPhotoZoom?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
}

export class CatService {
  private db: ProwlLogDatabase;
  private catRepo: CatRepository;
  private sightingRepo: SightingRepository;
  private photoRepo: PhotoRepository;
  private feedingRepo: FeedingLogRepository;

  constructor(db: ProwlLogDatabase = defaultDb) {
    this.db = db;
    this.catRepo = new CatRepository(db);
    this.sightingRepo = new SightingRepository(db);
    this.photoRepo = new PhotoRepository(db);
    this.feedingRepo = new FeedingLogRepository(db);
  }

  /**
   * Atomic creation of a new cat profile, its first sighting, optional photo, and optional feeding log.
   */
  async createCatWithFirstSighting(input: CreateCatFullInput): Promise<{
    cat: Cat;
    sighting: Sighting;
    photo?: CatPhoto | null;
    feedingLog?: FeedingLog | null;
  }> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Cat name is required.', 'name');
    }

    try {
      return await this.db.transaction(
        'rw',
        [this.db.cats, this.db.sightings, this.db.photos, this.db.feeding_logs],
        async () => {
          // 1. Create Cat Profile
          let cat = await this.catRepo.create({
            name: input.name,
            breed: input.breed,
            coatColors: input.coatColors,
            patterns: input.patterns,
            badgeRing: input.badgeRing,
            notes: input.notes,
          });

          // 2. Save Photos if provided
          const savedPhotos: CatPhoto[] = [];
          let savedCoverPhoto: CatPhoto | null = null;

          if (input.photos && input.photos.length > 0) {
            const hasCover = input.photos.some((p) => p.isCover);
            for (let i = 0; i < input.photos.length; i++) {
              const p = input.photos[i];
              const isCover = hasCover ? Boolean(p.isCover) : i === 0;

              const photo = await this.photoRepo.save({
                catId: cat.id,
                blob: p.blob,
                mimeType: p.mimeType || p.blob.type || 'image/jpeg',
                width: p.width,
                height: p.height,
                focalX: isCover ? (p.focalX ?? 0.5) : 0.5,
                focalY: isCover ? (p.focalY ?? 0.5) : 0.5,
                zoom: isCover ? (p.zoom ?? 1.0) : 1.0,
                latitude: p.latitude,
                longitude: p.longitude,
              });

              savedPhotos.push(photo);
              if (isCover) {
                savedCoverPhoto = photo;
              }
            }

            if (!savedCoverPhoto && savedPhotos.length > 0) {
              savedCoverPhoto = savedPhotos[0];
            }

            if (savedCoverPhoto) {
              cat = await this.catRepo.update(cat.id, {
                coverPhotoId: savedCoverPhoto.id,
              });
            }
          } else if (input.photoBlob) {
            const photo = await this.photoRepo.save({
              catId: cat.id,
              blob: input.photoBlob,
              mimeType: input.photoMimeType || 'image/jpeg',
              width: input.photoWidth,
              height: input.photoHeight,
              focalX: input.focalX,
              focalY: input.focalY,
              zoom: input.zoom,
              latitude: input.photoLatitude,
              longitude: input.photoLongitude,
            });

            savedPhotos.push(photo);
            savedCoverPhoto = photo;

            // Set as cover photo on cat profile
            cat = await this.catRepo.update(cat.id, {
              coverPhotoId: savedCoverPhoto.id,
            });
          }

          // 3. Create First Sighting
          const sighting = await this.sightingRepo.create({
            catId: cat.id,
            photoId: savedCoverPhoto ? savedCoverPhoto.id : null,
            latitude: input.latitude,
            longitude: input.longitude,
            locationName: input.locationName,
            notes: input.sightingNotes,
            spottedAt: input.spottedAt,
          });

          // Link sightingId to all saved photos
          for (const photo of savedPhotos) {
            await this.db.photos.update(photo.id, { sightingId: sighting.id });
            photo.sightingId = sighting.id;
          }

          // 4. Record Feeding Log if user fed the cat
          let savedFeeding: FeedingLog | null = null;
          if (input.fedCat && input.foodType) {
            savedFeeding = await this.feedingRepo.create({
              catId: cat.id,
              sightingId: sighting.id,
              foodType: input.foodType,
              notes: input.feedingNotes,
              fedAt: input.spottedAt || sighting.spottedAt,
            });
          }

          return {
            cat,
            sighting,
            photo: savedCoverPhoto,
            feedingLog: savedFeeding,
          };
        }
      );
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new DatabaseError('Failed to save cat profile and sighting atomically.', err);
    }
  }

  /**
   * Atomic creation of a new sighting for an existing cat profile.
   */
  async addSightingToExistingCat(input: AddSightingFullInput): Promise<{
    sighting: Sighting;
    photo?: CatPhoto | null;
    feedingLog?: FeedingLog | null;
  }> {
    if (!input.catId) {
      throw new ValidationError('A valid cat ID is required to add a sighting.', 'catId');
    }

    const cat = await this.catRepo.getById(input.catId);
    if (!cat) {
      throw new NotFoundError('Cat', input.catId);
    }

    try {
      return await this.db.transaction(
        'rw',
        [this.db.cats, this.db.sightings, this.db.photos, this.db.feeding_logs],
        async () => {
          // 1. Save Photo if provided
          let savedPhoto: CatPhoto | null = null;
          if (input.photoBlob) {
            savedPhoto = await this.photoRepo.save({
              catId: input.catId,
              blob: input.photoBlob,
              mimeType: input.photoMimeType || 'image/jpeg',
              width: input.photoWidth,
              height: input.photoHeight,
              focalX: input.focalX,
              focalY: input.focalY,
              zoom: input.zoom,
              latitude: input.photoLatitude,
              longitude: input.photoLongitude,
            });

            // Update cover photo if explicitly requested or if cat has no cover photo
            if (input.setAsCoverPhoto || !cat.coverPhotoId) {
              await this.catRepo.update(input.catId, {
                coverPhotoId: savedPhoto.id,
              });
            }
          }

          // 2. Create Sighting
          const sighting = await this.sightingRepo.create({
            catId: input.catId,
            photoId: savedPhoto ? savedPhoto.id : null,
            latitude: input.latitude,
            longitude: input.longitude,
            locationName: input.locationName,
            notes: input.notes,
            spottedAt: input.spottedAt,
          });

          // Link sightingId to photo
          if (savedPhoto) {
            await this.db.photos.update(savedPhoto.id, { sightingId: sighting.id });
            savedPhoto.sightingId = sighting.id;
          }

          // 3. Create Feeding Log if fed
          let savedFeeding: FeedingLog | null = null;
          if (input.fedCat && input.foodType) {
            savedFeeding = await this.feedingRepo.create({
              catId: input.catId,
              sightingId: sighting.id,
              foodType: input.foodType,
              notes: input.feedingNotes,
              fedAt: input.spottedAt || sighting.spottedAt,
            });
          }

          // 4. Update cat's updatedAt
          await this.catRepo.update(input.catId, {});

          return {
            sighting,
            photo: savedPhoto,
            feedingLog: savedFeeding,
          };
        }
      );
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw err;
      throw new DatabaseError('Failed to record sighting for existing cat.', err);
    }
  }

  /**
   * Update profile fields and optionally replace cover photo.
   * Historical sightings are never modified.
   */
  async updateCatProfile(
    catId: string,
    input: UpdateCatProfileInput
  ): Promise<Cat> {
    const existing = await this.catRepo.getById(catId);
    if (!existing) {
      throw new NotFoundError('Cat', catId);
    }

    try {
      return await this.db.transaction(
        'rw',
        [this.db.cats, this.db.photos, this.db.sightings],
        async () => {
          let newCoverPhotoId = existing.coverPhotoId;

          // If a new photo is provided, save it
          if (input.newPhotoBlob) {
            const photo = await this.photoRepo.save({
              catId,
              blob: input.newPhotoBlob,
              mimeType: input.newPhotoMimeType || 'image/jpeg',
              width: input.newPhotoWidth,
              height: input.newPhotoHeight,
              focalX: input.newPhotoFocalX,
              focalY: input.newPhotoFocalY,
              zoom: input.newPhotoZoom,
            });
            newCoverPhotoId = photo.id;
          }

          // If location fields are explicitly provided, update or create latest sighting
          if (input.latitude !== undefined || input.longitude !== undefined || input.locationName !== undefined) {
            const sightings = await this.sightingRepo.getByCatId(catId);
            if (sightings.length > 0) {
              await this.sightingRepo.update(sightings[0].id, {
                latitude: input.latitude,
                longitude: input.longitude,
                locationName: input.locationName,
              });
            } else if (input.latitude !== null && input.longitude !== null && input.latitude !== undefined && input.longitude !== undefined) {
              await this.sightingRepo.create({
                catId,
                latitude: input.latitude,
                longitude: input.longitude,
                locationName: input.locationName,
              });
            }
          }

          return await this.catRepo.update(catId, {
            name: input.name,
            breed: input.breed,
            coatColors: input.coatColors,
            patterns: input.patterns,
            badgeRing: input.badgeRing,
            notes: input.notes,
            coverPhotoId: newCoverPhotoId,
          });
        }
      );
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw err;
      throw new DatabaseError(`Failed to update cat profile "${catId}".`, err);
    }
  }

  /**
   * Get all photos for a cat, ordered by createdAt descending
   */
  async getCatPhotos(catId: string): Promise<CatPhoto[]> {
    return await this.photoRepo.getByCatId(catId);
  }

  /**
   * Delete a cat and cascade all associated sightings, photos, and feeding logs.
   */
  async deleteCat(catId: string): Promise<void> {
    await this.catRepo.deleteWithCascade(catId);
  }
}

export const catService = new CatService();
