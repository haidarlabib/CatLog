import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProwlLogDatabase } from '../db';
import { CatService } from '../services/catService';
import { BackupService } from '../services/backupService';

describe('End-to-End QA & Regression Suite (Milestone 6)', () => {
  let testDb: ProwlLogDatabase;
  let catService: CatService;
  let backupService: BackupService;

  beforeEach(() => {
    const dbName = `test-qa-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    catService = new CatService(testDb);
    backupService = new BackupService(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('verifies cascade deletion cleanly purges cat, all sightings, photos, and feeding logs without orphaned records', async () => {
    const photoBlob1 = new Blob(['photo-1'], { type: 'image/jpeg' });
    const photoBlob2 = new Blob(['photo-2'], { type: 'image/jpeg' });

    // Create cat with first sighting and feeding log
    const { cat, sighting: s1, photo: p1 } = await catService.createCatWithFirstSighting({
      name: 'Shadow',
      breed: 'Bombay',
      photoBlob: photoBlob1,
      latitude: -6.17,
      longitude: 106.81,
      locationName: 'Front Porch',
      fedCat: true,
      foodType: 'wet_food',
      feedingNotes: 'Canned salmon',
    });

    // Add second sighting with another photo
    const { sighting: s2, photo: p2 } = await catService.addSightingToExistingCat({
      catId: cat.id,
      photoBlob: photoBlob2,
      latitude: -6.18,
      longitude: 106.82,
      locationName: 'Roof Gutter',
    });

    // Verify initial presence
    expect(await testDb.cats.count()).toBe(1);
    expect(await testDb.sightings.count()).toBe(2);
    expect(await testDb.photos.count()).toBe(2);
    expect(await testDb.feeding_logs.count()).toBe(1);

    // Delete cat
    await catService.deleteCat(cat.id);

    // Verify complete cascade deletion
    expect(await testDb.cats.get(cat.id)).toBeUndefined();
    expect(await testDb.sightings.get(s1.id)).toBeUndefined();
    expect(await testDb.sightings.get(s2.id)).toBeUndefined();
    if (p1) expect(await testDb.photos.get(p1.id)).toBeUndefined();
    if (p2) expect(await testDb.photos.get(p2.id)).toBeUndefined();

    // Verify total counts across all stores are now 0
    expect(await testDb.cats.count()).toBe(0);
    expect(await testDb.sightings.count()).toBe(0);
    expect(await testDb.photos.count()).toBe(0);
    expect(await testDb.feeding_logs.count()).toBe(0);
  });

  it('guarantees that updating cat profile does not mutate or overwrite existing sighting timestamps or coordinates', async () => {
    const { cat, sighting } = await catService.createCatWithFirstSighting({
      name: 'Original Name',
      breed: 'Unknown',
      latitude: -6.21,
      longitude: 106.84,
      locationName: 'Original Location',
      spottedAt: '2026-05-01T10:00:00.000Z',
    });

    // Update profile details
    await catService.updateCatProfile(cat.id, {
      name: 'Renamed Cat',
      breed: 'Persian Mix',
      notes: 'Now has a red collar',
    });

    // Check cat
    const updatedCat = await testDb.cats.get(cat.id);
    expect(updatedCat?.name).toBe('Renamed Cat');
    expect(updatedCat?.breed).toBe('Persian Mix');

    // Check sighting remains completely unmodified
    const preservedSighting = await testDb.sightings.get(sighting.id);
    expect(preservedSighting?.locationName).toBe('Original Location');
    expect(preservedSighting?.spottedAt).toBe('2026-05-01T10:00:00.000Z');
    expect(preservedSighting?.latitude).toBe(-6.21);
    expect(preservedSighting?.longitude).toBe(106.84);
  });

  it('verifies that backup export and restore preserves relations across multiple cats and sightings', async () => {
    const { cat: catA } = await catService.createCatWithFirstSighting({
      name: 'Cat A',
      latitude: -6.1,
      longitude: 106.8,
    });
    const { cat: catB } = await catService.createCatWithFirstSighting({
      name: 'Cat B',
      latitude: -6.2,
      longitude: 106.9,
    });

    await catService.addSightingToExistingCat({
      catId: catA.id,
      latitude: -6.15,
      longitude: 106.85,
    });

    // Export backup
    const zipBlob = await backupService.exportBackup();
    const validation = await backupService.validateBackupFile(zipBlob);
    expect(validation.isValid).toBe(true);

    // Restore to an isolated new database
    const freshDb = new ProwlLogDatabase(`test-restore-qa-${crypto.randomUUID()}`);
    const freshBackupService = new BackupService(freshDb);

    try {
      await freshBackupService.restoreBackup(validation, 'replace');

      const restoredCats = await freshDb.cats.toArray();
      expect(restoredCats.length).toBe(2);

      const catASightings = await freshDb.sightings.where('catId').equals(catA.id).toArray();
      expect(catASightings.length).toBe(2);

      const catBSightings = await freshDb.sightings.where('catId').equals(catB.id).toArray();
      expect(catBSightings.length).toBe(1);
    } finally {
      await freshDb.delete();
    }
  });

  it('guarantees rollback on restore failure without altering previous database state', async () => {
    await catService.createCatWithFirstSighting({
      name: 'Safe Keep Cat',
    });

    const initialCatCount = await testDb.cats.count();
    expect(initialCatCount).toBe(1);

    // Construct an invalid backup with null id that causes DB bulkAdd rejection
    const invalidValidation = {
      isValid: true,
      data: {
        cats: [{ id: null as unknown as string, name: 'Invalid Cat', breed: 'x', createdAt: '', updatedAt: '' }],
        sightings: [],
        photos: [],
        feedingLogs: [],
        settings: [],
      },
    };

    // Attempt restore
    await expect(
      backupService.restoreBackup(invalidValidation as unknown as any, 'replace')
    ).rejects.toThrow();

    // Verify original database records were not destroyed or left corrupted
    const safeCat = await testDb.cats.toArray();
    expect(safeCat.length).toBe(1);
    expect(safeCat[0].name).toBe('Safe Keep Cat');
  });
});
