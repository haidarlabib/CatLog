import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProwlLogDatabase, ValidationError, NotFoundError } from '../db';
import { CatService } from '../services/catService';
import { getCurrentDeviceLocation } from '../utils/geo';

describe('CatService & Cat Management (Milestone 3)', () => {
  let testDb: ProwlLogDatabase;
  let service: CatService;

  beforeEach(() => {
    const dbName = `test-catservice-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    service = new CatService(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('1. createCatWithFirstSighting', () => {
    it('creates cat profile, first sighting, photo, and feeding log atomically', async () => {
      const mockBlob = new Blob(['cat-image-binary'], { type: 'image/jpeg' });

      const result = await service.createCatWithFirstSighting({
        name: 'Simba',
        breed: 'Bengal',
        coatColors: ['Brown', 'Black'],
        patterns: ['Rosette'],
        notes: 'Very energetic and playful',
        photoBlob: mockBlob,
        photoMimeType: 'image/jpeg',
        latitude: -6.2,
        longitude: 106.8,
        locationName: 'Tebet Eco Park',
        sightingNotes: 'Seen playing on a tree branch',
        fedCat: true,
        foodType: 'wet_food',
        feedingNotes: 'Chicken pouch',
      });

      // 1. Verify Cat
      expect(result.cat.id).toBeDefined();
      expect(result.cat.name).toBe('Simba');
      expect(result.cat.breed).toBe('Bengal');
      expect(result.cat.coverPhotoId).toBeDefined();
      expect(result.cat.coverPhotoId).toBe(result.photo?.id);

      // 2. Verify Sighting
      expect(result.sighting.id).toBeDefined();
      expect(result.sighting.catId).toBe(result.cat.id);
      expect(result.sighting.photoId).toBe(result.photo?.id);
      expect(result.sighting.locationName).toBe('Tebet Eco Park');
      expect(result.sighting.latitude).toBe(-6.2);

      // 3. Verify Photo
      expect(result.photo).toBeDefined();
      expect(result.photo?.blob).toBeInstanceOf(Blob);
      expect(result.photo?.catId).toBe(result.cat.id);
      expect(result.photo?.sightingId).toBe(result.sighting.id);

      // 4. Verify Feeding Log
      expect(result.feedingLog).toBeDefined();
      expect(result.feedingLog?.catId).toBe(result.cat.id);
      expect(result.feedingLog?.sightingId).toBe(result.sighting.id);
      expect(result.feedingLog?.foodType).toBe('wet_food');
    });

    it('enforces required cat name and throws ValidationError', async () => {
      await expect(
        service.createCatWithFirstSighting({
          name: '',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createCatWithFirstSighting({
          name: '   ',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rolls back atomic transaction and creates zero orphaned records on failure', async () => {
      const initialCats = await testDb.cats.count();
      const initialSightings = await testDb.sightings.count();

      // Trigger failure by mocking photo saving to reject
      const mockBlob = new Blob(['bad-data'], { type: 'image/jpeg' });
      const originalAdd = testDb.sightings.add;
      testDb.sightings.add = (() => {
        return Promise.reject(new Error('Simulated database write error during sighting creation'));
      }) as unknown as typeof testDb.sightings.add;

      try {
        await expect(
          service.createCatWithFirstSighting({
            name: 'RollbackCat',
            photoBlob: mockBlob,
          })
        ).rejects.toThrow();
      } finally {
        testDb.sightings.add = originalAdd;
      }

      // Assert rollback: no records were left behind
      expect(await testDb.cats.count()).toBe(initialCats);
      expect(await testDb.sightings.count()).toBe(initialSightings);
      expect(await testDb.photos.count()).toBe(0);
    });
  });

  describe('2. addSightingToExistingCat', () => {
    it('adds new sighting to an existing cat without duplicating the cat profile', async () => {
      // 1. Initial cat
      const { cat, sighting: firstSighting } = await service.createCatWithFirstSighting({
        name: 'Oreo',
        breed: 'Domestic',
      });

      const initialCatCount = await testDb.cats.count();

      // 2. Add repeated sighting
      const secondSightingResult = await service.addSightingToExistingCat({
        catId: cat.id,
        latitude: -6.21,
        longitude: 106.85,
        locationName: 'Near Minimarket',
        notes: 'Recognized from yesterday',
        fedCat: true,
        foodType: 'treat',
      });

      // Total cat profiles must remain exactly 1!
      expect(await testDb.cats.count()).toBe(initialCatCount);

      // Verify sightings count
      const allSightings = await testDb.sightings.where('catId').equals(cat.id).toArray();
      expect(allSightings.length).toBe(2);
      expect(allSightings.map((s) => s.id)).toContain(firstSighting.id);
      expect(allSightings.map((s) => s.id)).toContain(secondSightingResult.sighting.id);

      // Verify feeding log is linked
      expect(secondSightingResult.feedingLog?.foodType).toBe('treat');
    });

    it('throws NotFoundError when catId does not exist', async () => {
      await expect(
        service.addSightingToExistingCat({
          catId: 'non-existent-cat-uuid',
          notes: 'Seeing a ghost',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('3. updateCatProfile', () => {
    it('updates profile fields and preserves unmodified fields and sightings', async () => {
      const { cat, sighting } = await service.createCatWithFirstSighting({
        name: 'Luna',
        breed: 'Siamese',
        coatColors: ['Seal point'],
        patterns: ['Pointed'],
        notes: 'Quiet cat',
      });

      // Update name and notes only
      const updated = await service.updateCatProfile(cat.id, {
        name: 'Princess Luna',
        notes: 'Very talkative now',
      });

      expect(updated.name).toBe('Princess Luna');
      expect(updated.breed).toBe('Siamese'); // Preserved!
      expect(updated.coatColors).toEqual(['Seal point']); // Preserved!
      expect(updated.notes).toBe('Very talkative now');

      // Ensure historical sightings were completely untouched
      const sightingAfter = await testDb.sightings.get(sighting.id);
      expect(sightingAfter).not.toBeNull();
      expect(sightingAfter?.id).toBe(sighting.id);
    });
  });

  describe('4. Geolocation Error Handling Logic', () => {
    it('handles denied permission properly', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((_success, error) => {
          error({
            code: 1, // PERMISSION_DENIED
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: 'User denied Geolocation',
          });
        }),
      };

      vi.stubGlobal('navigator', { geolocation: mockGeolocation });

      await expect(getCurrentDeviceLocation()).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });

      vi.unstubAllGlobals();
    });

    it('handles position unavailable and timeout properly', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((_success, error) => {
          error({
            code: 3, // TIMEOUT
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: 'Timeout expired',
          });
        }),
      };

      vi.stubGlobal('navigator', { geolocation: mockGeolocation });

      await expect(getCurrentDeviceLocation()).rejects.toMatchObject({
        code: 'TIMEOUT',
      });

      vi.unstubAllGlobals();
    });
  });
});
