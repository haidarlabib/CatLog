import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import { ProwlLogDatabase } from '../db';
import { CatService } from '../services/catService';
import { BackupService, BACKUP_SCHEMA_VERSION } from '../services/backupService';

describe('BackupService (Milestone 5)', () => {
  let testDb: ProwlLogDatabase;
  let catService: CatService;
  let backupService: BackupService;

  beforeEach(() => {
    const dbName = `test-backup-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    catService = new CatService(testDb);
    backupService = new BackupService(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('performs a complete round-trip export and restore with binary photo blobs', async () => {
    const sampleBlob = new Blob(['photo-bytes-test-123'], { type: 'image/jpeg' });
    const { cat, sighting } = await catService.createCatWithFirstSighting({
      name: 'Simba',
      breed: 'Tabby',
      photoBlob: sampleBlob,
      latitude: -6.2,
      longitude: 106.8,
      locationName: 'Courtyard',
      fedCat: true,
      foodType: 'dry_food',
      feedingNotes: 'Morning kibble',
    });

    // Export to ZIP
    const backupZipBlob = await backupService.exportBackup();
    expect(backupZipBlob).toBeInstanceOf(Blob);
    expect(backupZipBlob.size).toBeGreaterThan(0);

    // Validate the ZIP file
    const validation = await backupService.validateBackupFile(backupZipBlob);
    expect(validation.isValid).toBe(true);
    expect(validation.manifest?.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(validation.manifest?.counts.cats).toBe(1);
    expect(validation.manifest?.counts.sightings).toBe(1);
    expect(validation.manifest?.counts.photos).toBe(1);
    expect(validation.manifest?.counts.feedingLogs).toBe(1);
    expect(validation.data?.cats[0].name).toBe('Simba');

    // Create a fresh new database to simulate restore on a new browser/device
    const restoreDbName = `test-restore-${crypto.randomUUID()}`;
    const restoreDb = new ProwlLogDatabase(restoreDbName);
    const restoreService = new BackupService(restoreDb);

    try {
      const result = await restoreService.restoreBackup(validation, 'replace');
      expect(result.restoredCats).toBe(1);
      expect(result.restoredSightings).toBe(1);
      expect(result.restoredPhotos).toBe(1);
      expect(result.restoredFeedingLogs).toBe(1);

      // Verify records in restored database
      const restoredCat = await restoreDb.cats.get(cat.id);
      expect(restoredCat).toBeDefined();
      expect(restoredCat?.name).toBe('Simba');

      const restoredSighting = await restoreDb.sightings.get(sighting.id);
      expect(restoredSighting).toBeDefined();
      expect(restoredSighting?.latitude).toBe(-6.2);

      const restoredPhotos = await restoreDb.photos.toArray();
      expect(restoredPhotos.length).toBe(1);
      expect(restoredPhotos[0].blob).toBeInstanceOf(Blob);
      const text = await restoredPhotos[0].blob.text();
      expect(text).toBe('photo-bytes-test-123');
    } finally {
      await restoreDb.delete();
    }
  });

  it('rejects corrupted or non-zip files safely', async () => {
    const corruptFile = new Blob(['not-a-valid-zip-content'], { type: 'application/zip' });
    const validation = await backupService.validateBackupFile(corruptFile);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('Corrupted or invalid ZIP');
  });

  it('rejects archives missing manifest.json', async () => {
    const zip = new JSZip();
    zip.file('data.json', JSON.stringify({ cats: [], sightings: [], photos: [] }));
    const blob = await zip.generateAsync({ type: 'blob' });

    const validation = await backupService.validateBackupFile(blob);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('missing manifest.json');
  });

  it('rejects archives with unsupported schema version', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        app: 'ProwlLog',
        version: '0.1.0',
        schemaVersion: 999, // Unsupported future version
        exportedAt: new Date().toISOString(),
        counts: { cats: 0, sightings: 0, photos: 0, feedingLogs: 0, settings: 0 },
      })
    );
    zip.file('data.json', JSON.stringify({ cats: [], sightings: [], photos: [] }));
    const blob = await zip.generateAsync({ type: 'blob' });

    const validation = await backupService.validateBackupFile(blob);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('Unsupported backup schema version: 999');
  });

  it('correctly detects ID conflicts and applies merge strategy', async () => {
    const { cat } = await catService.createCatWithFirstSighting({
      name: 'ExistingCat',
    });

    // Create a backup archive that contains the same cat ID with updated notes
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        app: 'ProwlLog',
        version: '0.1.0',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        counts: { cats: 1, sightings: 0, photos: 0, feedingLogs: 0, settings: 0 },
      })
    );
    zip.file(
      'data.json',
      JSON.stringify({
        cats: [
          {
            ...cat,
            notes: 'Updated notes via backup merge',
          },
        ],
        sightings: [],
        photos: [],
        feedingLogs: [],
        settings: [],
      })
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const validation = await backupService.validateBackupFile(blob);

    expect(validation.isValid).toBe(true);
    expect(validation.conflictCounts?.existingCats).toBe(1);

    // Apply merge
    await backupService.restoreBackup(validation, 'merge');

    const updatedCat = await testDb.cats.get(cat.id);
    expect(updatedCat?.notes).toBe('Updated notes via backup merge');
  });
});
