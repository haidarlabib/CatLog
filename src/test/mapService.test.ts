import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProwlLogDatabase } from '../db';
import { CatService } from '../services/catService';
import { MapService } from '../services/mapService';

describe('MapService & Interactive Map Logic (Milestone 4)', () => {
  let testDb: ProwlLogDatabase;
  let catService: CatService;
  let mapService: MapService;

  beforeEach(() => {
    const dbName = `test-map-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    catService = new CatService(testDb);
    mapService = new MapService(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('maps sightings with coordinates to the correct cat profile and photo', async () => {
    const mockBlob = new Blob(['cat-marker-photo'], { type: 'image/jpeg' });

    const { cat, sighting } = await catService.createCatWithFirstSighting({
      name: 'Oliver',
      breed: 'Domestic',
      photoBlob: mockBlob,
      latitude: -6.2,
      longitude: 106.8,
      locationName: 'Monas Park',
      sightingNotes: 'Playing near the fountain',
    });

    const markers = await mapService.getMapMarkers();
    expect(markers.length).toBe(1);
    expect(markers[0].sightingId).toBe(sighting.id);
    expect(markers[0].catId).toBe(cat.id);
    expect(markers[0].catName).toBe('Oliver');
    expect(markers[0].latitude).toBe(-6.2);
    expect(markers[0].longitude).toBe(106.8);
    expect(markers[0].locationName).toBe('Monas Park');
    expect(markers[0].photoBlob).toBeInstanceOf(Blob);
  });

  it('filters out sightings without valid coordinates', async () => {
    // 1 with coordinates, 1 without
    await catService.createCatWithFirstSighting({
      name: 'GPS Cat',
      latitude: -6.15,
      longitude: 106.75,
      locationName: 'Street Corner',
    });

    await catService.createCatWithFirstSighting({
      name: 'Indoor Cat',
      latitude: null,
      longitude: null,
      locationName: 'Home',
    });

    const markers = await mapService.getMapMarkers();
    expect(markers.length).toBe(1);
    expect(markers[0].latitude).toBe(-6.15);
  });

  it('generates multiple distinct markers for one cat with multiple sightings', async () => {
    const { cat } = await catService.createCatWithFirstSighting({
      name: 'Wanderer',
      latitude: -6.1,
      longitude: 106.8,
      locationName: 'Spot A',
    });

    // Add 2nd sighting
    await catService.addSightingToExistingCat({
      catId: cat.id,
      latitude: -6.2,
      longitude: 106.9,
      locationName: 'Spot B',
    });

    // Add 3rd sighting
    await catService.addSightingToExistingCat({
      catId: cat.id,
      latitude: -6.3,
      longitude: 106.7,
      locationName: 'Spot C',
    });

    const markers = await mapService.getMapMarkers();
    expect(markers.length).toBe(3);
    const locations = markers.map((m) => m.locationName);
    expect(locations).toContain('Spot A');
    expect(locations).toContain('Spot B');
    expect(locations).toContain('Spot C');
  });

  it('handles sightings where no photo was uploaded gracefully', async () => {
    await catService.createCatWithFirstSighting({
      name: 'NoPhotoCat',
      latitude: 1.23,
      longitude: 4.56,
      photoBlob: null,
    });

    const markers = await mapService.getMapMarkers();
    expect(markers.length).toBe(1);
    expect(markers[0].photoBlob).toBeNull();
  });

  it('safely manages lifecycle of transient Object URLs', () => {
    const mockBlob = new Blob(['sample-img'], { type: 'image/jpeg' });
    const markers = [
      {
        sightingId: 's1',
        catId: 'c1',
        catName: 'Cat 1',
        latitude: 1,
        longitude: 1,
        spottedAt: new Date().toISOString(),
        photoBlob: mockBlob,
      },
    ];

    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock-uuid');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const urls = mapService.createMarkerPhotoUrls(markers);
    expect(urls.get('s1')).toBe('blob:http://localhost/mock-uuid');

    mapService.revokeMarkerPhotoUrls(urls);
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/mock-uuid');
    expect(urls.size).toBe(0);

    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('includes badgeRing in MapMarkerData when present on cat profile', async () => {
    await catService.createCatWithFirstSighting({
      name: 'RingCat',
      badgeRing: 'Hijau',
      latitude: -6.18,
      longitude: 106.83,
    });

    const markers = await mapService.getMapMarkers();
    expect(markers.length).toBe(1);
    expect(markers[0].catName).toBe('RingCat');
    expect(markers[0].badgeRing).toBe('Hijau');
  });

  it('preserves all cats with identical coordinates without data loss', async () => {
    // Simulate 6 cats recorded at Waduk Setia Budi with identical coordinates
    const sharedLat = -6.2074;
    const sharedLng = 106.8287;
    const catNames = ['Luna', 'Milo', 'Oreo', 'Leo', 'Bella', 'Simba'];
    const badges = ['Rascal', 'Oopsie', 'Putih', 'Teal', 'Lavender', 'Terracotta'];

    for (let i = 0; i < catNames.length; i++) {
      await catService.createCatWithFirstSighting({
        name: catNames[i],
        badgeRing: badges[i],
        latitude: sharedLat,
        longitude: sharedLng,
        locationName: 'Waduk Setia Budi Barat',
      });
    }

    const markers = await mapService.getMapMarkers();
    expect(markers.length).toBe(6);

    // Ensure all 6 distinct cats are present with exact original coordinates
    markers.forEach((m) => {
      expect(m.latitude).toBe(sharedLat);
      expect(m.longitude).toBe(sharedLng);
      expect(m.locationName).toBe('Waduk Setia Budi Barat');
    });

    const retrievedNames = markers.map((m) => m.catName);
    expect(retrievedNames).toEqual(expect.arrayContaining(catNames));

    const retrievedBadges = markers.map((m) => m.badgeRing);
    expect(retrievedBadges).toEqual(expect.arrayContaining(badges));
  });
});

