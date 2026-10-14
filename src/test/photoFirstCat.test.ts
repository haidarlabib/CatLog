import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProwlLogDatabase } from '../db';
import { CatService } from '../services/catService';
import { catDraftStore } from '../utils/catDraftStore';

describe('Batch 5: Mandatory Photo-First Cat Creation Flow', () => {
  let testDb: ProwlLogDatabase;
  let service: CatService;

  beforeEach(() => {
    const dbName = `test-photofirst-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    service = new CatService(testDb);
    catDraftStore.clearAllDrafts();
  });

  afterEach(async () => {
    catDraftStore.clearAllDrafts();
    await testDb.delete();
  });

  describe('1. catDraftStore Lifecycle & Safety', () => {
    it('manages photo draft with URL creation and revokes URL on replacement or clear', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:http://localhost/test-photo-1');

      const mockBlob1 = new Blob(['mock-photo-data-1'], { type: 'image/jpeg' });
      const draft1 = catDraftStore.setPhotoDraft({
        blob: mockBlob1,
        crop: { focalX: 0.5, focalY: 0.5, zoom: 1.0 },
      });

      expect(draft1.previewUrl).toBe('blob:http://localhost/test-photo-1');
      expect(catDraftStore.hasPhotoDraft()).toBe(true);
      expect(catDraftStore.getPhotoDraft()?.blob).toBe(mockBlob1);

      // Replace with new draft -> previous URL should be revoked
      createObjectURLSpy.mockImplementation(() => 'blob:http://localhost/test-photo-2');
      const mockBlob2 = new Blob(['mock-photo-data-2'], { type: 'image/jpeg' });
      catDraftStore.setPhotoDraft({
        blob: mockBlob2,
        crop: { focalX: 0.6, focalY: 0.4, zoom: 1.5 },
      });

      expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/test-photo-1');
      expect(catDraftStore.getPhotoDraft()?.crop.zoom).toBe(1.5);

      // Clear draft -> current URL revoked and draft is null
      catDraftStore.clearPhotoDraft();
      expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/test-photo-2');
      expect(catDraftStore.hasPhotoDraft()).toBe(false);
      expect(catDraftStore.getPhotoDraft()).toBeNull();

      createObjectURLSpy.mockRestore();
      revokeSpy.mockRestore();
    });

    it('saves and restores form fields during "Ganti Foto" retake flow', () => {
      catDraftStore.setFormDraft({
        name: 'Oyen Pasar',
        breed: 'domestic_shorthair',
        badgeRing: 'ring-amber',
        coatColors: ['orange', 'white'],
        patterns: ['tabby'],
        notes: 'Suka nongkrong di dekat warung makan',
        latitude: -6.2146,
        longitude: 106.8451,
        locationName: 'Pasar Tebet',
        locationSource: 'gps',
      });

      const restored = catDraftStore.getFormDraft();
      expect(restored).not.toBeNull();
      expect(restored?.name).toBe('Oyen Pasar');
      expect(restored?.breed).toBe('domestic_shorthair');
      expect(restored?.badgeRing).toBe('ring-amber');
      expect(restored?.coatColors).toEqual(['orange', 'white']);
      expect(restored?.patterns).toEqual(['tabby']);
      expect(restored?.notes).toBe('Suka nongkrong di dekat warung makan');
      expect(restored?.latitude).toBe(-6.2146);
      expect(restored?.longitude).toBe(106.8451);
      expect(restored?.locationName).toBe('Pasar Tebet');

      // Thorough cleanup
      catDraftStore.clearAllDrafts();
      expect(catDraftStore.getFormDraft()).toBeNull();
      expect(catDraftStore.getPhotoDraft()).toBeNull();
    });
  });

  describe('2. Atomic Cat Creation with Mandatory Photo & Crop Metadata', () => {
    it('persists photo and crop metadata to a single shared record without duplicates', async () => {
      const mockPhotoBlob = new Blob(['high-res-cat-photo-binary'], { type: 'image/jpeg' });

      const result = await service.createCatWithFirstSighting({
        name: 'Mochi',
        breed: 'persian',
        badgeRing: 'ring-rose',
        coatColors: ['white'],
        patterns: ['solid'],
        notes: 'Kucing rumahan sangat jinak',
        latitude: -6.25,
        longitude: 106.82,
        locationName: 'Kemang Pratama',
        photoBlob: mockPhotoBlob,
        photoMimeType: 'image/jpeg',
        focalX: 0.65,
        focalY: 0.35,
        zoom: 1.4,
        photoLatitude: -6.2501,
        photoLongitude: 106.8202,
        fedCat: false,
      });

      // Verify Cat Profile
      expect(result.cat.id).toBeDefined();
      expect(result.cat.name).toBe('Mochi');
      expect(result.cat.coverPhotoId).toBeDefined();
      expect(result.cat.badgeRing).toBe('ring-rose');

      // Verify Sighting
      expect(result.sighting.id).toBeDefined();
      expect(result.sighting.catId).toBe(result.cat.id);
      expect(result.sighting.photoId).toBeDefined();

      // Verify Photo
      expect(result.photo).toBeDefined();
      expect(result.photo?.id).toBe(result.cat.coverPhotoId);
      expect(result.photo?.id).toBe(result.sighting.photoId);
      expect(result.photo?.sightingId).toBe(result.sighting.id);
      expect(result.photo?.catId).toBe(result.cat.id);

      // Verify Crop metadata
      expect(result.photo?.focalX).toBe(0.65);
      expect(result.photo?.focalY).toBe(0.35);
      expect(result.photo?.zoom).toBe(1.4);
      expect(result.photo?.latitude).toBe(-6.2501);
      expect(result.photo?.longitude).toBe(106.8202);

      // Verify ZERO duplicate records in database
      const allPhotosInDb = await testDb.photos.toArray();
      expect(allPhotosInDb).toHaveLength(1);
      expect(allPhotosInDb[0].id).toBe(result.photo?.id);
    });

    it('persists default crop values cleanly if none specified', async () => {
      const mockBlob = new Blob(['cat-binary'], { type: 'image/jpeg' });
      const result = await service.createCatWithFirstSighting({
        name: 'Luna',
        latitude: -6.175,
        longitude: 106.827,
        photoBlob: mockBlob,
      });

      expect(result.photo?.id).toBeDefined();
      const savedPhoto = await testDb.photos.get(result.photo!.id);
      expect(savedPhoto).toBeDefined();
      expect(savedPhoto?.focalX).toBe(0.5);
      expect(savedPhoto?.focalY).toBe(0.5);
      expect(savedPhoto?.zoom).toBe(1.0);
    });
  });
});
