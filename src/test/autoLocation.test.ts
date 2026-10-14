import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProwlLogDatabase } from '../db';
import { CatService } from '../services/catService';
import { PhotoRepository } from '../db/repositories/PhotoRepository';
import { BackupService } from '../services/backupService';
import { 
  isValidCoordinates, 
  reverseGeocode, 
  extractExifGps,
  formatCoordinates 
} from '../utils/geo';

describe('Automatic Location, EXIF Geotagging & Compact Preview Suite', () => {
  let testDb: ProwlLogDatabase;
  let catService: CatService;
  let photoRepo: PhotoRepository;
  let backupService: BackupService;

  beforeEach(() => {
    const dbName = `test-autoloc-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    catService = new CatService(testDb);
    photoRepo = new PhotoRepository(testDb);
    backupService = new BackupService(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
    vi.unstubAllGlobals();
  });

  describe('1. Coordinate Validation (isValidCoordinates)', () => {
    it('accepts valid coordinates within geographic bounds', () => {
      expect(isValidCoordinates(-6.2088, 106.8456)).toBe(true);
      expect(isValidCoordinates(0.1, 0.1)).toBe(true);
      expect(isValidCoordinates(-90, 180)).toBe(true);
      expect(isValidCoordinates(90, -180)).toBe(true);
    });

    it('rejects out of bounds latitude and longitude', () => {
      expect(isValidCoordinates(-90.1, 106.8)).toBe(false);
      expect(isValidCoordinates(90.1, 106.8)).toBe(false);
      expect(isValidCoordinates(-6.2, -180.1)).toBe(false);
      expect(isValidCoordinates(-6.2, 180.1)).toBe(false);
    });

    it('rejects (0, 0) Null Island as absent or default coordinates', () => {
      expect(isValidCoordinates(0, 0)).toBe(false);
    });

    it('rejects NaN, null, undefined, and non-number types', () => {
      expect(isValidCoordinates(NaN, 106.8)).toBe(false);
      expect(isValidCoordinates(-6.2, NaN)).toBe(false);
      expect(isValidCoordinates(null, 106.8)).toBe(false);
      expect(isValidCoordinates(-6.2, undefined)).toBe(false);
      expect(isValidCoordinates('-6.2', '106.8')).toBe(false);
    });
  });

  describe('2. Reverse Geocode Address Formatting', () => {
    it('formats road, house number, neighbourhood, and district correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          display_name: 'Jl. Merdeka, No. 12, Kuningan, Setiabudi, Jakarta Selatan',
          address: {
            road: 'Jl. Merdeka',
            house_number: '12',
            neighbourhood: 'Kuningan',
            city_district: 'Setiabudi',
            city: 'Jakarta Selatan',
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const address = await reverseGeocode(-6.22, 106.83);
      expect(address).toBe('Jl. Merdeka No. 12, Kuningan, Setiabudi');

      vi.unstubAllGlobals();
    });

    it('handles road without house number gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          display_name: 'Jl. Sudirman, Senayan, Jakarta Pusat',
          address: {
            road: 'Jl. Sudirman',
            suburb: 'Senayan',
            city: 'Jakarta Pusat',
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const address = await reverseGeocode(-6.21, 106.81);
      expect(address).toBe('Jl. Sudirman, Senayan');

      vi.unstubAllGlobals();
    });

    it('returns null when offline or fetch fails without breaking UI', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch (offline)'));
      vi.stubGlobal('fetch', mockFetch);

      const address = await reverseGeocode(-6.21, 106.81);
      expect(address).toBeNull();

      vi.unstubAllGlobals();
    });
  });

  describe('3. EXIF GPS Parsing & Geotag Validation', () => {
    it('returns null when file is not an image or has no EXIF', async () => {
      const mockBlob = new Blob(['not an actual image file'], { type: 'text/plain' });
      const gps = await extractExifGps(mockBlob);
      expect(gps).toBeNull();
    });

    it('correctly formats coordinates with 4-decimal precision', () => {
      expect(formatCoordinates(-6.208765, 106.845591)).toBe('Lat: -6.2088, Lng: 106.8456');
    });
  });

  describe('4. Location Precedence & Photo Geotag Persistence', () => {
    it('persists photo location coordinates alongside sighting coordinates in catService', async () => {
      const { cat } = await catService.createCatWithFirstSighting({
        name: 'GeoCat',
        latitude: -6.19,
        longitude: 106.82,
        locationName: 'Taman Suropati',
      });

      const photoBlob = new Blob(['image-bytes-mock'], { type: 'image/jpeg' });
      const encounterResult = await catService.addSightingToExistingCat({
        catId: cat.id,
        photoBlob,
        photoLatitude: -6.195,
        photoLongitude: 106.825,
        latitude: -6.195,
        longitude: 106.825,
        locationName: 'Taman Suropati Sisi Timur',
      });

      expect(encounterResult.sighting.latitude).toBe(-6.195);
      expect(encounterResult.sighting.longitude).toBe(106.825);
      expect(encounterResult.photo?.latitude).toBe(-6.195);
      expect(encounterResult.photo?.longitude).toBe(106.825);

      // Verify retrieval from DB
      const dbPhoto = await photoRepo.getById(encounterResult.photo!.id);
      expect(dbPhoto?.latitude).toBe(-6.195);
      expect(dbPhoto?.longitude).toBe(106.825);
    });

    it('exports and restores photo location coordinates faithfully in backup ZIP', async () => {
      const { cat } = await catService.createCatWithFirstSighting({
        name: 'BackupLocCat',
        latitude: -6.15,
        longitude: 106.85,
      });

      await catService.addSightingToExistingCat({
        catId: cat.id,
        photoBlob: new Blob(['photo-with-geo'], { type: 'image/jpeg' }),
        photoLatitude: -6.152,
        photoLongitude: 106.853,
        latitude: -6.15,
        longitude: 106.85,
      });

      // Export backup
      const backupBlob = await backupService.exportBackup();
      const file = new File([backupBlob], 'backup.zip', { type: 'application/zip' });
      const validation = await backupService.validateBackupFile(file);
      expect(validation.isValid).toBe(true);

      // Clear DB
      await testDb.cats.clear();
      await testDb.sightings.clear();
      await testDb.photos.clear();

      // Restore
      await backupService.restoreBackup(validation, 'replace');

      const restoredPhotos = await testDb.photos.toArray();
      expect(restoredPhotos.length).toBe(1);
      expect(restoredPhotos[0].latitude).toBe(-6.152);
      expect(restoredPhotos[0].longitude).toBe(106.853);
    });
  });
});
