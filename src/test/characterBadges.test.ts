import { describe, it, expect, beforeEach } from 'vitest';
import { 
  CHARACTER_BADGES, 
  resolveBadge, 
  formatAppearanceLabel,
} from '../config/catAppearance';
import { catService } from '../services/catService';
import { mapService } from '../services/mapService';
import { db, catRepository, sightingRepository, photoRepository } from '../db';
import { catDraftStore } from '../utils/catDraftStore';

describe('Batch 6: Character Badge Frames & Collapsible Coat Appearance', () => {
  beforeEach(async () => {
    await db.cats.clear();
    await db.sightings.clear();
    await db.photos.clear();
    catDraftStore.clearAllDrafts();
  });

  describe('1. Centralized Character Badges Configuration', () => {
    it('defines exactly six character identities with correct asset paths', () => {
      expect(CHARACTER_BADGES).toHaveLength(6);
      const ids = CHARACTER_BADGES.map((b) => b.id);
      expect(ids).toEqual(['oopsie', 'lil-boss', 'pinkie', 'bluebell', 'clover', 'rascal']);

      const assetPaths = CHARACTER_BADGES.map((b) => b.assetPath);
      expect(assetPaths).toEqual([
        '/borders/putih.png',
        '/borders/kuning.png',
        '/borders/pink.png',
        '/borders/biru.png',
        '/borders/hijau.png',
        '/borders/merah.png',
      ]);
    });

    it('has the exact supplied nicknames, epithets, and Indonesian descriptions', () => {
      const oopsie = CHARACTER_BADGES.find((b) => b.id === 'oopsie')!;
      expect(oopsie.nickname).toBe('Oopsie');
      expect(oopsie.epithet).toBe('Si Oon');
      expect(oopsie.description).toBe(
        'Polos, santai, dan sedikit bingung. Suka bengong, penasaran sama hal random, dan sering bertingkah konyol tanpa sadar.'
      );

      const lilBoss = CHARACTER_BADGES.find((b) => b.id === 'lil-boss')!;
      expect(lilBoss.nickname).toBe('Lil Boss');
      expect(lilBoss.epithet).toBe('Si Bos Nakal');
      expect(lilBoss.description).toBe(
        'Percaya diri, sok berkuasa, dan suka bikin ulah. Tingkahnya jahil, selalu ingin jadi pusat perhatian, tetapi tetap menggemaskan.'
      );

      const pinkie = CHARACTER_BADGES.find((b) => b.id === 'pinkie')!;
      expect(pinkie.nickname).toBe('Pinkie');
      expect(pinkie.epithet).toBe('Si Manis');
      expect(pinkie.description).toBe(
        'Lembut, manja, dan penuh pesona. Suka cari perhatian, senang dielus, dan punya tingkah yang bikin siapa pun gemas.'
      );

      const bluebell = CHARACTER_BADGES.find((b) => b.id === 'bluebell')!;
      expect(bluebell.nickname).toBe('Bluebell');
      expect(bluebell.epithet).toBe('Si Lucu');
      expect(bluebell.description).toBe(
        'Manis, menggemaskan, dan punya daya tarik tersendiri. Tingkahnya spontan, ekspresif, dan bikin orang susah menahan senyum.'
      );

      const clover = CHARACTER_BADGES.find((b) => b.id === 'clover')!;
      expect(clover.nickname).toBe('Clover');
      expect(clover.epithet).toBe('Si Ramah');
      expect(clover.description).toBe(
        'Hangat, bersahabat, dan mudah didekati. Suka menyapa, nyaman berada di dekat manusia, dan punya aura yang menenangkan.'
      );

      const rascal = CHARACTER_BADGES.find((b) => b.id === 'rascal')!;
      expect(rascal.nickname).toBe('Rascal');
      expect(rascal.epithet).toBe('Si Galak');
      expect(rascal.description).toBe(
        'Jutek, berani, dan sedikit temperamental. Suka pasang muka judes, punya pendirian kuat, tetapi tetap punya sisi lucu yang bikin gemas.'
      );
    });
  });

  describe('2. Backward Compatibility Badge Resolver (resolveBadge)', () => {
    it('resolves exact character badge IDs directly', () => {
      expect(resolveBadge('oopsie').id).toBe('oopsie');
      expect(resolveBadge('lil-boss').id).toBe('lil-boss');
      expect(resolveBadge('pinkie').id).toBe('pinkie');
      expect(resolveBadge('bluebell').id).toBe('bluebell');
      expect(resolveBadge('clover').id).toBe('clover');
      expect(resolveBadge('rascal').id).toBe('rascal');
    });

    it('resolves case-insensitively and handles nicknames', () => {
      expect(resolveBadge('OOPSIE').id).toBe('oopsie');
      expect(resolveBadge('Lil Boss').id).toBe('lil-boss');
      expect(resolveBadge('Si Manis').id).toBe('pinkie');
      expect(resolveBadge('BLUEBELL').id).toBe('bluebell');
      expect(resolveBadge('Si Ramah').id).toBe('clover');
      expect(resolveBadge('Si Galak').id).toBe('rascal');
    });

    it('resolves historical legacy color names to character badges', () => {
      // Terracotta / Orange / Yellow / Kuning -> Lil Boss (with kuning.png)
      expect(resolveBadge('terracotta').id).toBe('lil-boss');
      expect(resolveBadge('Terracotta').id).toBe('lil-boss');
      expect(resolveBadge('ring-terracotta').id).toBe('lil-boss');
      expect(resolveBadge('ring-amber').id).toBe('lil-boss');
      expect(resolveBadge('yellow').id).toBe('lil-boss');
      expect(resolveBadge('Kuning').id).toBe('lil-boss');
      expect(resolveBadge('ring-yellow').id).toBe('lil-boss');

      // Blue / Biru -> Bluebell
      expect(resolveBadge('blue').id).toBe('bluebell');
      expect(resolveBadge('Biru').id).toBe('bluebell');
      expect(resolveBadge('ring-blue').id).toBe('bluebell');
      expect(resolveBadge('ring-sky').id).toBe('bluebell');

      // Pink / Rose -> Pinkie
      expect(resolveBadge('pink').id).toBe('pinkie');
      expect(resolveBadge('Pink').id).toBe('pinkie');
      expect(resolveBadge('ring-pink').id).toBe('pinkie');
      expect(resolveBadge('ring-rose').id).toBe('pinkie');

      // Green / Hijau / Emerald -> Clover
      expect(resolveBadge('green').id).toBe('clover');
      expect(resolveBadge('Hijau').id).toBe('clover');
      expect(resolveBadge('ring-green').id).toBe('clover');
      expect(resolveBadge('ring-emerald').id).toBe('clover');

      // White / Putih -> Oopsie
      expect(resolveBadge('white').id).toBe('oopsie');
      expect(resolveBadge('Putih').id).toBe('oopsie');
      expect(resolveBadge('ring-white').id).toBe('oopsie');
    });

    it('resolves historical hex codes to corresponding character badges', () => {
      expect(resolveBadge('#EAB308').id).toBe('lil-boss'); // yellow/gold
      expect(resolveBadge('#D96B43').id).toBe('lil-boss'); // terracotta
      expect(resolveBadge('#3B82F6').id).toBe('bluebell'); // blue
      expect(resolveBadge('#EC4899').id).toBe('pinkie');   // pink
      expect(resolveBadge('#16A34A').id).toBe('clover');   // green
      expect(resolveBadge('#94A3B8').id).toBe('oopsie');   // white/pearl
    });

    it('safely falls back to Oopsie for missing, null, undefined, or unknown badge values', () => {
      expect(resolveBadge(null).id).toBe('oopsie');
      expect(resolveBadge(undefined).id).toBe('oopsie');
      expect(resolveBadge('').id).toBe('oopsie');
      expect(resolveBadge('unknown-random-badge').id).toBe('oopsie');
      expect(resolveBadge('#999999').id).toBe('oopsie');
    });
  });

  describe('3. Mandatory Badge Selection & Cat Persistence', () => {
    it('persists selected character badge through catService.createCatWithFirstSighting', async () => {
      const photoBlob = new Blob(['sample-cat-photo-bytes'], { type: 'image/jpeg' });

      const result = await catService.createCatWithFirstSighting({
        name: 'Mochi',
        breed: 'domestic',
        badgeRing: 'pinkie',
        coatColors: ['white', 'orange'],
        patterns: ['tabby'],
        notes: 'Kucing manis dan suka mengeong.',
        latitude: -6.2088,
        longitude: 106.8456,
        locationName: 'Taman Suropati, Jakarta',
        photoBlob,
        focalX: 0.6,
        focalY: 0.4,
        zoom: 1.2,
      });

      expect(result.cat).toBeDefined();
      expect(result.cat.badgeRing).toBe('pinkie');

      // Verify stored record in IndexedDB
      const stored = await catRepository.getById(result.cat.id);
      expect(stored).toBeDefined();
      expect(stored?.badgeRing).toBe('pinkie');
      expect(stored?.name).toBe('Mochi');
      expect(stored?.coatColors).toEqual(['white', 'orange']);
      expect(stored?.patterns).toEqual(['tabby']);
    });

    it('updates and persists character badge through catService.updateCatProfile', async () => {
      const created = await catRepository.create({
        name: 'Oyen',
        breed: 'persian',
        badgeRing: 'lil-boss',
      });

      const updated = await catService.updateCatProfile(created.id, {
        name: 'Oyen Si Bos',
        badgeRing: 'rascal',
      });

      expect(updated.badgeRing).toBe('rascal');

      const reloaded = await catRepository.getById(created.id);
      expect(reloaded?.badgeRing).toBe('rascal');
      expect(reloaded?.name).toBe('Oyen Si Bos');
    });

    it('persists badgeRing in cat draft store and preserves selection', () => {
      catDraftStore.setFormDraft({
        name: 'Kuro',
        breed: 'unknown',
        badgeRing: 'clover',
        coatColors: ['black'],
        patterns: ['solid'],
        notes: 'Kucing ramah jalanan',
        latitude: -6.1754,
        longitude: 106.8272,
        locationName: 'Monas',
        locationSource: 'gps',
      });

      const draft = catDraftStore.getFormDraft();
      expect(draft).not.toBeNull();
      expect(draft?.badgeRing).toBe('clover');
      expect(draft?.name).toBe('Kuro');
      expect(draft?.coatColors).toEqual(['black']);
    });
  });

  describe('4. Map Marker Propagation & Resolution', () => {
    it('propagates character badge through mapService.getMapMarkers', async () => {
      const catRecord = await catRepository.create({
        name: 'Simba',
        badgeRing: 'bluebell',
      });

      const photoBlob = new Blob(['photo-binary'], { type: 'image/jpeg' });
      const photoRecord = await photoRepository.save({
        catId: catRecord.id,
        blob: photoBlob,
        mimeType: 'image/jpeg',
      });

      await catRepository.update(catRecord.id, {
        coverPhotoId: photoRecord.id,
      });

      await sightingRepository.create({
        catId: catRecord.id,
        spottedAt: new Date().toISOString(),
        latitude: -6.9175,
        longitude: 107.6191,
        locationName: 'Bandung',
        photoId: photoRecord.id,
      });

      const markers = await mapService.getMapMarkers();
      expect(markers).toHaveLength(1);
      expect(markers[0].catName).toBe('Simba');
      expect(markers[0].badgeRing).toBe('bluebell');

      // Test map marker badge resolution
      const resolved = resolveBadge(markers[0].badgeRing);
      expect(resolved.id).toBe('bluebell');
      expect(resolved.assetPath).toBe('/borders/biru.png');
      expect(resolved.nickname).toBe('Bluebell');
      expect(resolved.epithet).toBe('Si Lucu');
    });

    it('resolves legacy marker badge values correctly on map markers', async () => {
      const catRecord = await catRepository.create({
        name: 'Legacy Cat',
        badgeRing: 'Terracotta', // Old stored value
      });

      await sightingRepository.create({
        catId: catRecord.id,
        spottedAt: new Date().toISOString(),
        latitude: -7.2575,
        longitude: 112.7521,
        locationName: 'Surabaya',
      });

      const markers = await mapService.getMapMarkers();
      expect(markers).toHaveLength(1);
      expect(markers[0].badgeRing).toBe('Terracotta');

      // Legacy value resolves cleanly to Lil Boss with kuning.png
      const resolved = resolveBadge(markers[0].badgeRing);
      expect(resolved.id).toBe('lil-boss');
      expect(resolved.assetPath).toBe('/borders/kuning.png');
      expect(resolved.nickname).toBe('Lil Boss');
    });
  });

  describe('5. Collapsible Appearance & Labels', () => {
    it('formats appearance labels accurately for summary display', () => {
      expect(formatAppearanceLabel('white')).toBe('Putih');
      expect(formatAppearanceLabel('orange')).toBe('Oranye');
      expect(formatAppearanceLabel('tabby')).toBe('Tabby');
      expect(formatAppearanceLabel('calico')).toBe('Calico');
      expect(formatAppearanceLabel('custom-color')).toBe('custom-color');
    });
  });

  describe('6. Batch 6.3 Horizontal Row Badge Selector & Asset Calibration', () => {
    it('defines per-asset calibration parameters for all six character badges', () => {
      for (const badge of CHARACTER_BADGES) {
        expect(badge.calibration).toBeDefined();
        expect(badge.calibration.frameScale).toBeGreaterThanOrEqual(0.9);
        expect(badge.calibration.frameScale).toBeLessThanOrEqual(1.2);
        expect(badge.calibration.photoDiameter).toBeGreaterThanOrEqual(40);
        expect(badge.calibration.photoDiameter).toBeLessThanOrEqual(65);
        expect(badge.calibration.photoCenterX).toBeGreaterThanOrEqual(45);
        expect(badge.calibration.photoCenterX).toBeLessThanOrEqual(55);
        expect(badge.calibration.photoCenterY).toBeGreaterThanOrEqual(45);
        expect(badge.calibration.photoCenterY).toBeLessThanOrEqual(55);
      }
    });

    it('renders 6 options in a single horizontal row with direct PNGs, circular ring, and no cards or helper text', async () => {
      const { renderToString } = await import('react-dom/server');
      const { BadgeSelector } = await import('../components/BadgeSelector');

      const React = await import('react');
      const html = renderToString(
        React.createElement(BadgeSelector, {
          selectedBadgeId: 'lil-boss',
          onSelect: () => {},
        })
      );

      // Verify horizontal row layout container
      expect(html).toContain('colour-badge-row');
      expect(html).not.toContain('colour-badge-grid');

      // Verify all 6 options are present with accessible radio roles and IDs
      expect(html).toContain('id="badge-option-oopsie"');
      expect(html).toContain('id="badge-option-lil-boss"');
      expect(html).toContain('id="badge-option-pinkie"');
      expect(html).toContain('id="badge-option-bluebell"');
      expect(html).toContain('id="badge-option-clover"');
      expect(html).toContain('id="badge-option-rascal"');

      // Verify selected state has circular ring and .selected class
      expect(html).toContain('colour-badge-btn selected');
      expect(html).toContain('badge-select-ring');

      // Verify direct PNG image asset
      expect(html).toContain('badge-btn-img');

      // Verify NO rectangular cards, NO center circles, NO checkmark badges
      expect(html).not.toContain('colour-badge-card');
      expect(html).not.toContain('badge-frame-center');
      expect(html).not.toContain('badge-card-check');

      // Verify NO text, nicknames, epithets, info buttons, or tooltips
      expect(html).not.toContain('badge-nickname');
      expect(html).not.toContain('badge-epithet');
      expect(html).not.toContain('badge-info-btn');
      expect(html).not.toContain('badge-personality-popover');
      expect(html).not.toContain('badge-personality-tooltip');

      // Verify helper text is COMPLETELY removed
      expect(html).not.toContain('Pilih satu badge untuk penanda kucingmu.');
    });
  });
});

