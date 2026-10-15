import { describe, it, expect } from 'vitest';
import { calculateGeoDistanceMeters, groupMarkersBy50mRadius, computeClusterStackModel } from '../utils/geo';
import { formatCatTraitLine } from '../config/catAppearance';
import type { MapMarkerData } from '../services/mapService';

describe('Strict 50m Map Clustering & Cat Trait Line (Batch 6.10)', () => {
  // Reference point in Jakarta (Waduk Melati / Setiabudi)
  const baseLat = -6.200000;
  const baseLng = 106.820000;

  // At equator / Jakarta latitude (-6.2 deg):
  // 1 degree latitude ~= 111,000 meters -> 1 meter ~= 0.000009009 deg lat
  // 40 meters north ~= +0.000360 deg lat
  // 50 meters north ~= +0.000450 deg lat
  // 60 meters north ~= +0.000540 deg lat

  function createTestMarker(id: string, name: string, lat: number, lng: number): MapMarkerData {
    return {
      sightingId: `sighting-${id}`,
      catId: `cat-${id}`,
      catName: name,
      latitude: lat,
      longitude: lng,
      spottedAt: new Date().toISOString(),
      locationName: 'Test Area',
      photoBlob: null,
      photoUrl: undefined,
      badgeRing: 'lil_boss',
    };
  }

  describe('calculateGeoDistanceMeters', () => {
    it('returns 0 for identical coordinates', () => {
      const d = calculateGeoDistanceMeters(baseLat, baseLng, baseLat, baseLng);
      expect(d).toBe(0);
    });

    it('calculates geographic distance accurately', () => {
      // 0.00045 degrees latitude difference in Jakarta
      const dist = calculateGeoDistanceMeters(baseLat, baseLng, baseLat + 0.00045, baseLng);
      // Roughly 50 meters (49.9 - 50.1m)
      expect(dist).toBeGreaterThan(49);
      expect(dist).toBeLessThan(51);
    });
  });

  describe('groupMarkersBy50mRadius', () => {
    it('groups 2 cats when geographic distance is strictly less than 50 meters', () => {
      // Offset by ~30 meters (0.00027 deg lat)
      const cat1 = createTestMarker('1', 'Luna', baseLat, baseLng);
      const cat2 = createTestMarker('2', 'Milo', baseLat + 0.00027, baseLng);

      const actualDist = calculateGeoDistanceMeters(cat1.latitude, cat1.longitude, cat2.latitude, cat2.longitude);
      expect(actualDist).toBeLessThan(50);

      const groups = groupMarkersBy50mRadius([cat1, cat2]);
      expect(groups.length).toBe(1);
      expect(groups[0].markers.length).toBe(2);
      expect(groups[0].markers.map((m) => m.catName)).toEqual(['Luna', 'Milo']);
    });

    it('does NOT group 2 cats when geographic distance is exactly or greater than 50 meters', () => {
      // Find coordinates where distance is >= 50m (e.g. 52 meters)
      // 0.00047 deg lat is ~52.2m
      const cat1 = createTestMarker('1', 'Luna', baseLat, baseLng);
      const cat2 = createTestMarker('2', 'Milo', baseLat + 0.00047, baseLng);

      const actualDist = calculateGeoDistanceMeters(cat1.latitude, cat1.longitude, cat2.latitude, cat2.longitude);
      expect(actualDist).toBeGreaterThanOrEqual(50);

      const groups = groupMarkersBy50mRadius([cat1, cat2]);
      // Must remain 2 separate single-marker groups
      expect(groups.length).toBe(2);
      expect(groups[0].markers.length).toBe(1);
      expect(groups[1].markers.length).toBe(1);
    });

    it('strictly separates markers at > 50 meters', () => {
      // 100 meters apart
      const cat1 = createTestMarker('1', 'Luna', baseLat, baseLng);
      const cat2 = createTestMarker('2', 'Oreo', baseLat + 0.0009, baseLng);

      const actualDist = calculateGeoDistanceMeters(cat1.latitude, cat1.longitude, cat2.latitude, cat2.longitude);
      expect(actualDist).toBeGreaterThan(95);

      const groups = groupMarkersBy50mRadius([cat1, cat2]);
      expect(groups.length).toBe(2);
    });

    it('prevents daisy-chain expansion (marker chaining) beyond 50m limit', () => {
      // Cat A at 0m
      // Cat B at +30m from A (within 50m of A)
      // Cat C at +60m from A (within 30m of B, but 60m from A)
      // Chaining check: Cat C should NOT join group of [A, B] because dist(A, C) = 60m >= 50m
      const catA = createTestMarker('A', 'CatA', baseLat, baseLng);
      const catB = createTestMarker('B', 'CatB', baseLat + 0.00027, baseLng);
      const catC = createTestMarker('C', 'CatC', baseLat + 0.00054, baseLng);

      const distAB = calculateGeoDistanceMeters(catA.latitude, catA.longitude, catB.latitude, catB.longitude);
      const distBC = calculateGeoDistanceMeters(catB.latitude, catB.longitude, catC.latitude, catC.longitude);
      const distAC = calculateGeoDistanceMeters(catA.latitude, catA.longitude, catC.latitude, catC.longitude);

      expect(distAB).toBeLessThan(50);
      expect(distBC).toBeLessThan(50);
      expect(distAC).toBeGreaterThan(50);

      const groups = groupMarkersBy50mRadius([catA, catB, catC]);
      // Cat A and B cluster together (dist < 50m). Cat C stays separate because it is > 50m from A!
      expect(groups.length).toBe(2);
      const groupWithAB = groups.find((g) => g.markers.some((m) => m.catName === 'CatA'));
      expect(groupWithAB?.markers.map((m) => m.catName)).toEqual(['CatA', 'CatB']);

      const groupWithC = groups.find((g) => g.markers.some((m) => m.catName === 'CatC'));
      expect(groupWithC?.markers.length).toBe(1);
    });
  });

  describe('formatCatTraitLine', () => {
    it('formats breed, colors, and pattern cleanly when all available', () => {
      const line = formatCatTraitLine('Persian', ['white', 'black'], ['solid']);
      expect(line).toBe('Persia · Putih, Hitam · Polos');
    });

    it('formats only breed when colors and patterns are missing', () => {
      const line = formatCatTraitLine('Persian', [], []);
      expect(line).toBe('Persia');
    });

    it('formats breed and pattern when color is missing', () => {
      const line = formatCatTraitLine('Domestic', [], ['tabby']);
      expect(line).toBe('Domestik / Kampung · Tabby');
    });

    it('formats colors and pattern when breed is unknown or missing', () => {
      const line1 = formatCatTraitLine(undefined, ['orange', 'white'], ['bicolor']);
      expect(line1).toBe('Oranye, Putih · Belang');

      const line2 = formatCatTraitLine('unknown', ['orange'], []);
      expect(line2).toBe('Oranye');

      const line3 = formatCatTraitLine('not sure yet', ['calico'], []);
      expect(line3).toBe('Calico');
    });

    it('returns null when all traits are absent or empty without hanging separators', () => {
      expect(formatCatTraitLine(undefined, undefined, undefined)).toBeNull();
      expect(formatCatTraitLine('', [], [])).toBeNull();
      expect(formatCatTraitLine('unknown', [], [])).toBeNull();
    });
  });

  describe('computeClusterStackModel (Stacked Cat Photo Clusters)', () => {
    it('returns 1 photo for 1 cat without extra indicator', () => {
      const model = computeClusterStackModel(1);
      expect(model.displayedCount).toBe(1);
      expect(model.extraCount).toBe(0);
      expect(model.hasExtra).toBe(false);
      expect(model.extraLabel).toBeNull();
    });

    it('returns 2 photos for 2 cats without extra indicator', () => {
      const model = computeClusterStackModel(2);
      expect(model.displayedCount).toBe(2);
      expect(model.extraCount).toBe(0);
      expect(model.hasExtra).toBe(false);
      expect(model.extraLabel).toBeNull();
    });

    it('returns 3 photos for 3 cats without extra indicator', () => {
      const model = computeClusterStackModel(3);
      expect(model.displayedCount).toBe(3);
      expect(model.extraCount).toBe(0);
      expect(model.hasExtra).toBe(false);
      expect(model.extraLabel).toBeNull();
    });

    it('returns max 3 photos and exact +1 for 4 cats', () => {
      const model = computeClusterStackModel(4);
      expect(model.displayedCount).toBe(3);
      expect(model.extraCount).toBe(1);
      expect(model.hasExtra).toBe(true);
      expect(model.extraLabel).toBe('+1');
    });

    it('returns max 3 photos and exact +2 for 5 cats', () => {
      const model = computeClusterStackModel(5);
      expect(model.displayedCount).toBe(3);
      expect(model.extraCount).toBe(2);
      expect(model.hasExtra).toBe(true);
      expect(model.extraLabel).toBe('+2');
    });

    it('returns max 3 photos and exact +N for any larger cluster', () => {
      const model = computeClusterStackModel(10);
      expect(model.displayedCount).toBe(3);
      expect(model.extraCount).toBe(7);
      expect(model.hasExtra).toBe(true);
      expect(model.extraLabel).toBe('+7');
    });
  });
});

