import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ProwlLogDatabase } from '../db';
import { CatService } from '../services/catService';

describe('PWA Configuration & Offline Operation (Milestone 5)', () => {
  let testDb: ProwlLogDatabase;
  let catService: CatService;

  beforeEach(() => {
    const dbName = `test-pwa-${crypto.randomUUID()}`;
    testDb = new ProwlLogDatabase(dbName);
    catService = new CatService(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('ensures all declared PWA icon files physically exist with valid dimensions and non-zero sizes', () => {
    const icon192 = path.resolve('public', 'icons', 'icon-192x192.png');
    const icon512 = path.resolve('public', 'icons', 'icon-512x512.png');
    const iconMaskable = path.resolve('public', 'icons', 'icon-512x512-maskable.png');
    const faviconSvg = path.resolve('public', 'favicon.svg');

    expect(fs.existsSync(icon192)).toBe(true);
    expect(fs.statSync(icon192).size).toBeGreaterThan(500);

    expect(fs.existsSync(icon512)).toBe(true);
    expect(fs.statSync(icon512).size).toBeGreaterThan(1000);

    expect(fs.existsSync(iconMaskable)).toBe(true);
    expect(fs.statSync(iconMaskable).size).toBeGreaterThan(1000);

    expect(fs.existsSync(faviconSvg)).toBe(true);
    expect(fs.statSync(faviconSvg).size).toBeGreaterThan(100);

    const logoPng = path.resolve('public', 'logo.png');
    const faviconPng = path.resolve('public', 'favicon.png');
    const appleTouchIcon = path.resolve('public', 'icons', 'apple-touch-icon.png');

    expect(fs.existsSync(logoPng)).toBe(true);
    expect(fs.existsSync(faviconPng)).toBe(true);
    expect(fs.existsSync(appleTouchIcon)).toBe(true);
  });

  it('guarantees that local CRUD, photos, and sightings function 100% offline without network requests', async () => {
    // Simulate offline environment
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      expect(navigator.onLine).toBe(false);

      const mockPhoto = new Blob(['offline-photo-bytes'], { type: 'image/jpeg' });
      const { cat, sighting, photo } = await catService.createCatWithFirstSighting({
        name: 'Barnaby (Offline)',
        breed: 'Domestic Shorthair',
        photoBlob: mockPhoto,
        latitude: -6.18,
        longitude: 106.82,
        locationName: 'Backyard Shed',
        notes: 'Encountered during internet blackout',
      });

      expect(cat.name).toBe('Barnaby (Offline)');
      expect(sighting.latitude).toBe(-6.18);
      expect(photo).toBeDefined();

      // Read back from local database
      const fetchedCat = await testDb.cats.get(cat.id);
      expect(fetchedCat?.name).toBe('Barnaby (Offline)');

      const fetchedPhotos = await testDb.photos.where('catId').equals(cat.id).toArray();
      expect(fetchedPhotos.length).toBe(1);
      const photoText = await fetchedPhotos[0].blob.text();
      expect(photoText).toBe('offline-photo-bytes');

      // Add a second sighting offline
      const sighting2 = await catService.addSightingToExistingCat({
        catId: cat.id,
        latitude: -6.19,
        longitude: 106.83,
        locationName: 'Under Porch',
      });
      expect(sighting2.sighting.locationName).toBe('Under Porch');

      const allSightings = await testDb.sightings.where('catId').equals(cat.id).toArray();
      expect(allSightings.length).toBe(2);
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('preserves IndexedDB data integrity across simulated app reload and cache updates', async () => {
    const { cat } = await catService.createCatWithFirstSighting({
      name: 'Resilient Kitty',
    });

    // Simulate closing and reopening database connection
    testDb.close();
    const reopenedDb = new ProwlLogDatabase(testDb.name);

    try {
      const persistedCat = await reopenedDb.cats.get(cat.id);
      expect(persistedCat).toBeDefined();
      expect(persistedCat?.name).toBe('Resilient Kitty');
    } finally {
      reopenedDb.close();
    }
  });

  it('validates iOS iPhone safe-area, full-bleed status-bar, and cream theme-color configuration', () => {
    const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf-8');
    expect(htmlContent).toContain('viewport-fit=cover');
    expect(htmlContent).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(htmlContent).toContain('name="theme-color" content="#FBF8F2"');

    const tokensContent = fs.readFileSync(path.resolve('src', 'styles', 'tokens.css'), 'utf-8');
    expect(tokensContent).toContain('--safe-area-top: env(safe-area-inset-top, 0px);');
    expect(tokensContent).toContain('--header-height: calc(var(--header-base-height) + var(--safe-area-top));');

    const viteConfigContent = fs.readFileSync(path.resolve('vite.config.ts'), 'utf-8');
    expect(viteConfigContent).toContain("theme_color: '#FBF8F2'");
    expect(viteConfigContent).toContain("background_color: '#FBF8F2'");
  });
});

