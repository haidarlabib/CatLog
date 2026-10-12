import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProwlLogDatabase,
  CatRepository,
  SightingRepository,
  PhotoRepository,
  FeedingLogRepository,
  SettingsRepository,
  ValidationError,
  NotFoundError,
  RelationError,
  StorageQuotaError,
} from '../db';

describe('ProwlLog Local Storage Layer (Milestone 2)', () => {
  let testDb: ProwlLogDatabase;
  let catRepo: CatRepository;
  let sightingRepo: SightingRepository;
  let photoRepo: PhotoRepository;
  let feedingRepo: FeedingLogRepository;
  let settingsRepo: SettingsRepository;

  beforeEach(() => {
    // Generate an isolated database for each test to prevent data leakage
    const dbName = `test-prowllog-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);

    catRepo = new CatRepository(testDb);
    sightingRepo = new SightingRepository(testDb);
    photoRepo = new PhotoRepository(testDb);
    feedingRepo = new FeedingLogRepository(testDb);
    settingsRepo = new SettingsRepository(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('1. CatRepository CRUD & Validation', () => {
    it('creates a cat with valid input and default fields', async () => {
      const cat = await catRepo.create({
        name: 'Mochi',
        breed: 'Domestic',
        coatColors: ['White', 'Orange'],
        patterns: ['Tabby'],
        notes: 'Friendly orange tabby living near garden',
      });

      expect(cat.id).toBeDefined();
      expect(cat.name).toBe('Mochi');
      expect(cat.breed).toBe('Domestic');
      expect(cat.coatColors).toEqual(['White', 'Orange']);
      expect(cat.createdAt).toBeDefined();
      expect(cat.updatedAt).toBe(cat.createdAt);

      const fetched = await catRepo.getById(cat.id);
      expect(fetched).toEqual(cat);
    });

    it('throws ValidationError when creating cat with empty or whitespace name', async () => {
      await expect(catRepo.create({ name: '' })).rejects.toThrow(ValidationError);
      await expect(catRepo.create({ name: '   ' })).rejects.toThrow(ValidationError);
    });

    it('updates cat fields and updates updatedAt timestamp', async () => {
      const cat = await catRepo.create({ name: 'Luna', breed: 'Siamese' });
      const originalUpdatedAt = cat.updatedAt;

      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 5));

      const updated = await catRepo.update(cat.id, {
        name: 'Luna Queen',
        notes: 'Loves sleeping in the sun',
      });

      expect(updated.name).toBe('Luna Queen');
      expect(updated.breed).toBe('Siamese'); // Preserved original field
      expect(updated.notes).toBe('Loves sleeping in the sun');
      expect(updated.updatedAt).not.toBe(originalUpdatedAt);

      const refreshed = await catRepo.getById(cat.id);
      expect(refreshed?.name).toBe('Luna Queen');
    });

    it('throws NotFoundError when updating non-existent cat', async () => {
      await expect(
        catRepo.update('non-existent-id', { name: 'Ghost' })
      ).rejects.toThrow(NotFoundError);
    });

    it('searches cats by name, breed, or coat color', async () => {
      await catRepo.create({ name: 'Oreo', breed: 'Domestic', coatColors: ['Black', 'White'] });
      await catRepo.create({ name: 'Garfield', breed: 'Persian', coatColors: ['Orange'] });

      const nameResults = await catRepo.search('reo');
      expect(nameResults.length).toBe(1);
      expect(nameResults[0].name).toBe('Oreo');

      const breedResults = await catRepo.search('persian');
      expect(breedResults.length).toBe(1);
      expect(breedResults[0].name).toBe('Garfield');

      const colorResults = await catRepo.search('orange');
      expect(colorResults.length).toBe(1);
      expect(colorResults[0].name).toBe('Garfield');
    });
  });

  describe('2. PhotoRepository (Blob Storage & Retrieval)', () => {
    it('stores a genuine Blob in IndexedDB and retrieves it correctly', async () => {
      const cat = await catRepo.create({ name: 'Cleo' });

      // Create a mock image Blob with binary data
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
      const imageBlob = new Blob([binaryData], { type: 'image/png' });

      const photo = await photoRepo.save({
        catId: cat.id,
        blob: imageBlob,
        mimeType: 'image/png',
        width: 800,
        height: 600,
      });

      expect(photo.id).toBeDefined();
      expect(photo.catId).toBe(cat.id);
      expect(photo.mimeType).toBe('image/png');
      expect(photo.blob).toBeInstanceOf(Blob);
      expect(photo.blob.size).toBe(binaryData.byteLength);

      // Read back from DB
      const retrieved = await photoRepo.getById(photo.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.blob).toBeInstanceOf(Blob);
      expect(retrieved?.blob.size).toBe(imageBlob.size);
      expect(retrieved?.blob.type).toBe('image/png');

      // Verify binary content
      const buffer = await retrieved!.blob.arrayBuffer();
      expect(new Uint8Array(buffer)).toEqual(binaryData);
    });

    it('rejects photo if referenced catId does not exist (RelationError)', async () => {
      const mockBlob = new Blob(['sample-cat-photo'], { type: 'image/jpeg' });
      await expect(
        photoRepo.save({
          catId: 'non-existent-cat',
          blob: mockBlob,
          mimeType: 'image/jpeg',
        })
      ).rejects.toThrow(RelationError);
    });

    it('rejects photo if blob is invalid or mimeType is not an image (ValidationError)', async () => {
      const cat = await catRepo.create({ name: 'Simba' });

      // Non-blob
      await expect(
        photoRepo.save({
          catId: cat.id,
          blob: 'not-a-blob' as unknown as Blob,
          mimeType: 'image/jpeg',
        })
      ).rejects.toThrow(ValidationError);

      // Non-image mimeType
      const textBlob = new Blob(['hello'], { type: 'text/plain' });
      await expect(
        photoRepo.save({
          catId: cat.id,
          blob: textBlob,
          mimeType: 'text/plain',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('catches and translates QuotaExceededError into StorageQuotaError', async () => {
      const cat = await catRepo.create({ name: 'Milo' });
      const mockBlob = new Blob(['sample-cat-data'], { type: 'image/jpeg' });

      // Mock testDb.photos.add to throw a QuotaExceededError DOMException
      const originalAdd = testDb.photos.add;
      testDb.photos.add = (() => {
        const error = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return Promise.reject(error);
      }) as unknown as typeof testDb.photos.add;

      try {
        await expect(
          photoRepo.save({
            catId: cat.id,
            blob: mockBlob,
            mimeType: 'image/jpeg',
          })
        ).rejects.toThrow(StorageQuotaError);
      } finally {
        testDb.photos.add = originalAdd;
      }
    });
  });

  describe('3. Sightings & Feeding Logs Relations', () => {
    it('creates a sighting linked to a cat and filters coordinates for map', async () => {
      const cat = await catRepo.create({ name: 'Whiskers' });

      const sighting1 = await sightingRepo.create({
        catId: cat.id,
        latitude: -6.2088,
        longitude: 106.8456,
        locationName: 'Central Park Jakarta',
        notes: 'Chilling under the bench',
      });

      const sighting2 = await sightingRepo.create({
        catId: cat.id,
        latitude: null,
        longitude: null,
        locationName: 'Indoors (no GPS)',
      });

      expect(sighting1.id).toBeDefined();
      expect(sighting1.catId).toBe(cat.id);
      expect(sighting2.id).toBeDefined();

      const catSightings = await sightingRepo.getByCatId(cat.id);
      expect(catSightings.length).toBe(2);

      // Check map coordinate filter
      const mapSightings = await sightingRepo.getAllWithCoordinates();
      expect(mapSightings.length).toBe(1);
      expect(mapSightings[0].id).toBe(sighting1.id);
    });

    it('throws RelationError when creating sighting for non-existent cat', async () => {
      await expect(
        sightingRepo.create({
          catId: 'ghost-cat',
          latitude: 10,
          longitude: 20,
        })
      ).rejects.toThrow(RelationError);
    });

    it('validates coordinate boundaries', async () => {
      const cat = await catRepo.create({ name: 'Felix' });

      await expect(
        sightingRepo.create({
          catId: cat.id,
          latitude: 95, // Max is 90
          longitude: 100,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        sightingRepo.create({
          catId: cat.id,
          latitude: 0,
          longitude: 200, // Max is 180
        })
      ).rejects.toThrow(ValidationError);
    });

    it('creates feeding logs and enforces valid foodType and cat relation', async () => {
      const cat = await catRepo.create({ name: 'Oliver' });

      const log = await feedingRepo.create({
        catId: cat.id,
        foodType: 'wet_food',
        notes: 'Salmon pate can',
      });

      expect(log.id).toBeDefined();
      expect(log.foodType).toBe('wet_food');

      const logs = await feedingRepo.getByCatId(cat.id);
      expect(logs.length).toBe(1);
      expect(logs[0].notes).toBe('Salmon pate can');

      // Invalid foodType
      await expect(
        feedingRepo.create({
          catId: cat.id,
          foodType: 'pizza' as unknown as 'wet_food',
        })
      ).rejects.toThrow(ValidationError);

      // Non-existent cat
      await expect(
        feedingRepo.create({
          catId: 'non-existent',
          foodType: 'treat',
        })
      ).rejects.toThrow(RelationError);
    });

    it('deleting a single sighting cleans up its associated photos while preserving parent cat', async () => {
      const cat = await catRepo.create({ name: 'Shadow' });
      const sighting = await sightingRepo.create({ catId: cat.id, latitude: 10, longitude: 20 });
      const photo = await photoRepo.save({
        catId: cat.id,
        sightingId: sighting.id,
        blob: new Blob(['sighting-photo'], { type: 'image/jpeg' }),
        mimeType: 'image/jpeg',
      });

      expect(await sightingRepo.getById(sighting.id)).not.toBeNull();
      expect(await photoRepo.getById(photo.id)).not.toBeNull();

      // Delete the sighting
      await sightingRepo.delete(sighting.id);

      // Verify sighting and associated photo are removed, but parent cat remains
      expect(await sightingRepo.getById(sighting.id)).toBeNull();
      expect(await photoRepo.getById(photo.id)).toBeNull();
      expect(await catRepo.getById(cat.id)).not.toBeNull();
    });
  });

  describe('4. Atomic Cascade Delete and Transaction Safety', () => {
    it('deletes cat and cascades removal to all sightings, photos, and feeding logs', async () => {
      // Setup cat with full relational records
      const cat = await catRepo.create({ name: 'Nala' });

      const sighting = await sightingRepo.create({
        catId: cat.id,
        latitude: -6.1,
        longitude: 106.8,
      });

      const photo = await photoRepo.save({
        catId: cat.id,
        sightingId: sighting.id,
        blob: new Blob(['photo-bytes'], { type: 'image/jpeg' }),
        mimeType: 'image/jpeg',
      });

      const feeding = await feedingRepo.create({
        catId: cat.id,
        foodType: 'dry_food',
      });

      // Verify records exist before deletion
      expect(await catRepo.getById(cat.id)).not.toBeNull();
      expect(await sightingRepo.getById(sighting.id)).not.toBeNull();
      expect(await photoRepo.getById(photo.id)).not.toBeNull();
      expect(await feedingRepo.getById(feeding.id)).not.toBeNull();

      // Perform cascade delete
      await catRepo.deleteWithCascade(cat.id);

      // Verify all related records are removed atomically
      expect(await catRepo.getById(cat.id)).toBeNull();
      expect(await sightingRepo.getById(sighting.id)).toBeNull();
      expect(await photoRepo.getById(photo.id)).toBeNull();
      expect(await feedingRepo.getById(feeding.id)).toBeNull();
    });

    it('rolls back transaction and does not leave partial data if an operation fails', async () => {
      const cat = await catRepo.create({ name: 'Tiger' });
      await sightingRepo.create({ catId: cat.id, latitude: 1, longitude: 2 });

      // Simulate an atomic transaction where an error occurs midway
      const initialCatCount = await catRepo.count();
      const initialSightingCount = await sightingRepo.count();

      await expect(
        testDb.transaction('rw', [testDb.cats, testDb.sightings], async () => {
          await testDb.cats.add({
            id: 'temp-cat-1',
            name: 'Temp Cat',
            breed: 'unknown',
            coatColors: [],
            patterns: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Deliberately trigger failure inside transaction
          throw new Error('Simulation of catastrophic transaction failure');
        })
      ).rejects.toThrow('Simulation of catastrophic transaction failure');

      // Verify rollback occurred: counts must match initial state exactly
      expect(await catRepo.count()).toBe(initialCatCount);
      expect(await sightingRepo.count()).toBe(initialSightingCount);
      expect(await catRepo.getById('temp-cat-1')).toBeNull();
    });
  });

  describe('5. SettingsRepository & Global Reset', () => {
    it('sets and retrieves application settings', async () => {
      await settingsRepo.set('theme', 'dark');
      await settingsRepo.set('defaultZoom', 14);

      expect(await settingsRepo.get('theme')).toBe('dark');
      expect(await settingsRepo.get('defaultZoom')).toBe(14);
      expect(await settingsRepo.get('nonExistentKey', 'fallback')).toBe('fallback');
    });

    it('clears all data atomically across all 5 stores', async () => {
      const cat = await catRepo.create({ name: 'Boots' });
      await sightingRepo.create({ catId: cat.id, latitude: 1, longitude: 1 });
      await settingsRepo.set('key', 'value');

      expect(await catRepo.count()).toBe(1);
      expect(await sightingRepo.count()).toBe(1);

      await settingsRepo.clearAllData();

      expect(await catRepo.count()).toBe(0);
      expect(await sightingRepo.count()).toBe(0);
      expect(await photoRepo.getByCatId(cat.id)).toEqual([]);
      expect(await settingsRepo.getAll()).toEqual([]);
    });
  });
});
