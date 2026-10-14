import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProwlLogDatabase } from '../db';
import { PhotoRepository } from '../db/repositories/PhotoRepository';
import { CatService } from '../services/catService';
import { MapService } from '../services/mapService';
import { BackupService } from '../services/backupService';
import { clampCrop, getCropStyle, DEFAULT_PHOTO_CROP } from '../utils/image';

describe('Photo Display, Crop Adjustment & Map Avatars (Batch 3)', () => {
  let testDb: ProwlLogDatabase;
  let photoRepo: PhotoRepository;
  let catService: CatService;
  let mapService: MapService;
  let backupService: BackupService;

  beforeEach(() => {
    const dbName = `test-photocrop-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    photoRepo = new PhotoRepository(testDb);
    catService = new CatService(testDb);
    mapService = new MapService(testDb);
    backupService = new BackupService(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('1. Crop Calculation & Sanitization (clampCrop & getCropStyle)', () => {
    it('returns default crop when crop is null, undefined, or empty', () => {
      expect(clampCrop(null)).toEqual(DEFAULT_PHOTO_CROP);
      expect(clampCrop(undefined)).toEqual(DEFAULT_PHOTO_CROP);
      expect(clampCrop({})).toEqual(DEFAULT_PHOTO_CROP);
    });

    it('bounds focalX and focalY strictly between 0 and 1', () => {
      expect(clampCrop({ focalX: -0.5, focalY: 1.5, zoom: 1.0 })).toEqual({
        focalX: 0,
        focalY: 1,
        zoom: 1.0,
      });

      expect(clampCrop({ focalX: 2.0, focalY: -1.0, zoom: 1.0 })).toEqual({
        focalX: 1,
        focalY: 0,
        zoom: 1.0,
      });
    });

    it('bounds zoom multiplier between 1.0 and 3.0', () => {
      expect(clampCrop({ focalX: 0.5, focalY: 0.5, zoom: 0.2 })).toEqual({
        focalX: 0.5,
        focalY: 0.5,
        zoom: 1.0,
      });

      expect(clampCrop({ focalX: 0.5, focalY: 0.5, zoom: 5.0 })).toEqual({
        focalX: 0.5,
        focalY: 0.5,
        zoom: 3.0,
      });
    });

    it('generates correct CSS styling for 1.0x default zoom without transform', () => {
      const style = getCropStyle({ focalX: 0.5, focalY: 0.5, zoom: 1.0 });
      expect(style.objectPosition).toBe('50.0% 50.0%');
      expect(style.transformOrigin).toBe('50.0% 50.0%');
      expect(style.transform).toBeUndefined();
    });

    it('generates correct CSS styling when zoomed in and panned', () => {
      const style = getCropStyle({ focalX: 0.25, focalY: 0.75, zoom: 1.8 });
      expect(style.objectPosition).toBe('25.0% 75.0%');
      expect(style.transformOrigin).toBe('25.0% 75.0%');
      expect(style.transform).toBe('scale(1.80)');
    });
  });

  describe('2. Photo Persistence & Non-destructive Crop Storage', () => {
    it('persists crop metadata in PhotoRepository alongside raw Blob', async () => {
      await testDb.cats.add({
        id: 'cat-1',
        name: 'Oren',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockBlob = new Blob(['sample-cat-photo'], { type: 'image/jpeg' });
      const photo = await photoRepo.save({
        catId: 'cat-1',
        blob: mockBlob,
        mimeType: 'image/jpeg',
        focalX: 0.35,
        focalY: 0.65,
        zoom: 1.5,
      });

      expect(photo.id).toBeDefined();
      expect(photo.focalX).toBe(0.35);
      expect(photo.focalY).toBe(0.65);
      expect(photo.zoom).toBe(1.5);
      expect(photo.blob).toBe(mockBlob);

      // Verify retrieval from IndexedDB
      const loaded = await photoRepo.getById(photo.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.focalX).toBe(0.35);
      expect(loaded?.focalY).toBe(0.65);
      expect(loaded?.zoom).toBe(1.5);
    });

    it('handles legacy photos without crop metadata by using safe defaults', async () => {
      // Direct raw DB insert simulating old database record
      await testDb.photos.add({
        id: 'legacy-photo-id',
        catId: 'cat-1',
        blob: new Blob(['legacy-photo'], { type: 'image/jpeg' }),
        mimeType: 'image/jpeg',
        createdAt: new Date().toISOString(),
      });

      const loaded = await photoRepo.getById('legacy-photo-id');
      expect(loaded).not.toBeNull();
      // clampCrop safely handles missing crop fields
      const effectiveCrop = clampCrop({
        focalX: loaded?.focalX ?? undefined,
        focalY: loaded?.focalY ?? undefined,
        zoom: loaded?.zoom ?? undefined,
      });
      expect(effectiveCrop).toEqual(DEFAULT_PHOTO_CROP);
    });

    it('updates crop coordinates on an existing photo via updateCrop without re-uploading blob', async () => {
      await testDb.cats.add({
        id: 'cat-crop-test',
        name: 'Belang',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const originalBlob = new Blob(['raw-photo-bytes'], { type: 'image/jpeg' });
      const saved = await photoRepo.save({
        catId: 'cat-crop-test',
        blob: originalBlob,
        mimeType: 'image/jpeg',
      });

      // Update crop only
      const updated = await photoRepo.updateCrop(saved.id, {
        focalX: 0.2,
        focalY: 0.8,
        zoom: 2.0,
      });

      expect(updated.focalX).toBe(0.2);
      expect(updated.focalY).toBe(0.8);
      expect(updated.zoom).toBe(2.0);

      // Verify persistence in IndexedDB
      const reloaded = await photoRepo.getById(saved.id);
      expect(reloaded?.focalX).toBe(0.2);
      expect(reloaded?.focalY).toBe(0.8);
      expect(reloaded?.zoom).toBe(2.0);
      expect(reloaded?.blob).toBeInstanceOf(Blob);
    });
  });

  describe('3. Encounter Workflow & CatService Crop Propagation', () => {
    it('saves crop metadata when adding a sighting to an existing cat', async () => {
      const { cat } = await catService.createCatWithFirstSighting({
        name: 'Kuro',
        breed: 'Bombay',
      });

      const mockBlob = new Blob(['kuro-encounter-photo'], { type: 'image/jpeg' });
      const encounterResult = await catService.addSightingToExistingCat({
        catId: cat.id,
        photoBlob: mockBlob,
        photoMimeType: 'image/jpeg',
        focalX: 0.4,
        focalY: 0.6,
        zoom: 1.4,
        latitude: -6.2,
        longitude: 106.8,
        locationName: 'Taman Kota',
        setAsCoverPhoto: true,
      });

      expect(encounterResult.photo).toBeDefined();
      expect(encounterResult.photo?.focalX).toBe(0.4);
      expect(encounterResult.photo?.focalY).toBe(0.6);
      expect(encounterResult.photo?.zoom).toBe(1.4);

      // Verify that cat coverPhotoId was linked
      const updatedCat = await testDb.cats.get(cat.id);
      expect(updatedCat?.coverPhotoId).toBe(encounterResult.photo?.id);
    });

    it('propagates photo crop metadata into MapMarkerData for circular map avatars', async () => {
      const { cat } = await catService.createCatWithFirstSighting({
        name: 'MapCat',
        badgeRing: 'Biru',
        latitude: -6.19,
        longitude: 106.84,
      });

      const markerBlob = new Blob(['marker-photo'], { type: 'image/jpeg' });
      const sightingResult = await catService.addSightingToExistingCat({
        catId: cat.id,
        photoBlob: markerBlob,
        focalX: 0.3,
        focalY: 0.7,
        zoom: 1.6,
        latitude: -6.195,
        longitude: 106.845,
      });

      const markers = await mapService.getMapMarkers();
      const marker = markers.find((m) => m.sightingId === sightingResult.sighting.id);
      expect(marker).toBeDefined();
      expect(marker?.badgeRing).toBe('Biru');
      expect(marker?.focalX).toBe(0.3);
      expect(marker?.focalY).toBe(0.7);
      expect(marker?.zoom).toBe(1.6);
    });
  });

  describe('4. Backup and Restore with Photo Crop Metadata', () => {
    it('exports and restores photo crop metadata seamlessly', async () => {
      const { cat } = await catService.createCatWithFirstSighting({
        name: 'BackupCat',
      });

      await catService.addSightingToExistingCat({
        catId: cat.id,
        photoBlob: new Blob(['backup-test-image'], { type: 'image/jpeg' }),
        focalX: 0.15,
        focalY: 0.85,
        zoom: 2.2,
      });

      // Export backup ZIP
      const backupBlob = await backupService.exportBackup();
      expect(backupBlob).toBeInstanceOf(Blob);

      // Clear current DB
      await testDb.cats.clear();
      await testDb.sightings.clear();
      await testDb.photos.clear();

      // Validate & restore backup
      const file = new File([backupBlob], 'backup.zip', { type: 'application/zip' });
      const validation = await backupService.validateBackupFile(file);
      expect(validation.isValid).toBe(true);

      const restoreResult = await backupService.restoreBackup(validation, 'replace');
      expect(restoreResult.restoredPhotos).toBe(1);

      // Verify restored photo has original crop metadata
      const restoredPhotos = await testDb.photos.toArray();
      expect(restoredPhotos.length).toBe(1);
      expect(restoredPhotos[0].focalX).toBe(0.15);
      expect(restoredPhotos[0].focalY).toBe(0.85);
      expect(restoredPhotos[0].zoom).toBe(2.2);
    });
  });
});
