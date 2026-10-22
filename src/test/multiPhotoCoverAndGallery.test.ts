import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProwlLogDatabase } from '../db';
import { CatService } from '../services/catService';
import { catDraftStore } from '../utils/catDraftStore';

describe('Multi-Photo, Cover Photo Selection, and Detail Gallery', () => {
  let testDb: ProwlLogDatabase;
  let service: CatService;

  beforeEach(() => {
    const dbName = `test-multiphoto-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    service = new CatService(testDb);
    catDraftStore.clearAllDrafts();
  });

  afterEach(async () => {
    catDraftStore.clearAllDrafts();
    await testDb.delete();
  });

  describe('1. catDraftStore Multi-Photo & Cover Management', () => {
    it('manages multiple photos and maintains cover photo selection', () => {
      const blob1 = new Blob(['photo-1'], { type: 'image/jpeg' });
      const blob2 = new Blob(['photo-2'], { type: 'image/jpeg' });
      const blob3 = new Blob(['photo-3'], { type: 'image/jpeg' });

      // Add 3 photos
      const p1 = catDraftStore.addPhotoDraft({ blob: blob1 });
      const p2 = catDraftStore.addPhotoDraft({ blob: blob2 });
      const p3 = catDraftStore.addPhotoDraft({ blob: blob3 });

      // First photo is default cover
      expect(p1.isCover).toBe(true);
      expect(catDraftStore.getCoverPhotoDraft()?.id).toBe(p1.id);
      expect(catDraftStore.getPhotosDraft().length).toBe(3);

      // Change cover to photo 2
      catDraftStore.setCoverPhoto(p2.id);
      expect(catDraftStore.getCoverPhotoDraft()?.id).toBe(p2.id);
      expect(catDraftStore.getCoverPhotoDraft()?.isCover).toBe(true);

      // Verify photo 1 is no longer cover
      const allPhotos = catDraftStore.getPhotosDraft();
      expect(allPhotos.find((p) => p.id === p1.id)?.isCover).toBe(false);

      // Update crop on cover photo
      catDraftStore.updateCoverCrop({ focalX: 0.7, focalY: 0.3, zoom: 1.8 });
      expect(catDraftStore.getCoverPhotoDraft()?.crop.zoom).toBe(1.8);
      expect(catDraftStore.getCoverPhotoDraft()?.crop.focalX).toBe(0.7);

      // Non-cover photos remain unchanged
      expect(allPhotos.find((p) => p.id === p3.id)?.crop.zoom).toBe(1.0);

      // Remove photo 2 (which was cover) -> photo 1 becomes new cover automatically
      catDraftStore.removePhotoDraft(p2.id);
      expect(catDraftStore.getPhotosDraft().length).toBe(2);
      expect(catDraftStore.getCoverPhotoDraft()?.id).toBe(p1.id);
      expect(catDraftStore.getCoverPhotoDraft()?.isCover).toBe(true);
    });

    it('batch sets photos with setPhotosDraft and preserves designated cover', () => {
      const blobA = new Blob(['photo-a'], { type: 'image/jpeg' });
      const blobB = new Blob(['photo-b'], { type: 'image/jpeg' });

      catDraftStore.setPhotosDraft([
        { blob: blobA, isCover: false },
        { blob: blobB, isCover: true, crop: { focalX: 0.4, focalY: 0.6, zoom: 1.5 } },
      ]);

      expect(catDraftStore.getPhotosDraft().length).toBe(2);
      const cover = catDraftStore.getCoverPhotoDraft();
      expect(cover).not.toBeNull();
      expect(cover?.isCover).toBe(true);
      expect(cover?.crop.zoom).toBe(1.5);
      expect(catDraftStore.hasPhotoDraft()).toBe(true);
    });
  });

  describe('2. catService Multi-Photo Persistence & Cover Linking', () => {
    it('saves all photos to IndexedDB and links coverPhotoId specifically to the designated cover', async () => {
      const blob1 = new Blob(['cat-angle-1'], { type: 'image/jpeg' });
      const blob2 = new Blob(['cat-angle-2-cover'], { type: 'image/jpeg' });
      const blob3 = new Blob(['cat-angle-3'], { type: 'image/jpeg' });

      const result = await service.createCatWithFirstSighting({
        name: 'Luna',
        breed: 'angora',
        badgeRing: 'ring-cyan',
        latitude: -6.2,
        longitude: 106.8,
        locationName: 'Taman Suropati',
        photos: [
          {
            blob: blob1,
            isCover: false,
          },
          {
            blob: blob2,
            isCover: true, // Selected as Sampul!
            focalX: 0.6,
            focalY: 0.4,
            zoom: 1.4,
          },
          {
            blob: blob3,
            isCover: false,
          },
        ],
      });

      // Cat profile must have coverPhotoId set
      expect(result.cat.id).toBeDefined();
      expect(result.cat.name).toBe('Luna');
      expect(result.cat.coverPhotoId).toBeDefined();

      // Sighting must have photoId matching cover photo
      expect(result.sighting.photoId).toBe(result.cat.coverPhotoId);

      // Verify all 3 photos were saved in database
      const allPhotos = await service.getCatPhotos(result.cat.id);
      expect(allPhotos.length).toBe(3);

      // Verify cover photo has custom focal and zoom
      const coverRecord = allPhotos.find((p) => p.id === result.cat.coverPhotoId);
      expect(coverRecord).toBeDefined();
      expect(coverRecord?.focalX).toBe(0.6);
      expect(coverRecord?.focalY).toBe(0.4);
      expect(coverRecord?.zoom).toBe(1.4);

      // Verify non-cover photos have default crop
      const nonCoverPhotos = allPhotos.filter((p) => p.id !== result.cat.coverPhotoId);
      expect(nonCoverPhotos.length).toBe(2);
      nonCoverPhotos.forEach((p) => {
        expect(p.focalX).toBe(0.5);
        expect(p.focalY).toBe(0.5);
        expect(p.zoom).toBe(1.0);
      });

      // Verify cascading delete removes all 3 photos
      await service.deleteCat(result.cat.id);
      const remainingPhotos = await service.getCatPhotos(result.cat.id);
      expect(remainingPhotos.length).toBe(0);
    });
  });
});
