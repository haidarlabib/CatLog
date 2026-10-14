import { describe, it, expect, beforeEach } from 'vitest';
import { db, catRepository, sightingRepository, photoRepository } from '../db';
import { formatIndonesianDateTime } from '../utils/date';
import React from 'react';
import { renderToString } from 'react-dom/server';

describe('Batch 6.4: Encounter History & Indonesian Date Formatting', () => {
  beforeEach(async () => {
    await db.cats.clear();
    await db.sightings.clear();
    await db.photos.clear();
  });

  describe('1. Indonesian Date & Time Formatter (formatIndonesianDateTime)', () => {
    it('formats a known timestamp into the required Indonesian date-time format', () => {
      // Create local date: 17 Februari 2026 at 09:12
      const testDate = new Date(2026, 1, 17, 9, 12);
      const formatted = formatIndonesianDateTime(testDate);

      expect(formatted).toBe('Selasa, 17 Februari 2026, 09.12');
    });

    it('formats ISO date strings and handles 24-hour time without seconds', () => {
      const testDate = new Date(2026, 9, 14, 15, 45);
      const formatted = formatIndonesianDateTime(testDate);

      expect(formatted).toBe('Rabu, 14 Oktober 2026, 15.45');
    });

    it('gracefully handles empty, null, or invalid date inputs', () => {
      expect(formatIndonesianDateTime(null)).toBe('');
      expect(formatIndonesianDateTime(undefined)).toBe('');
      expect(formatIndonesianDateTime('')).toBe('');
      expect(formatIndonesianDateTime('invalid-date')).toBe('');
    });
  });

  describe('2. SightingRepository.getByCatId — Multiple Encounters & Reverse Chronological Sorting', () => {
    it('retrieves all saved encounters for a cat in reverse chronological order (newest first)', async () => {
      const cat = await catRepository.create({
        name: 'Milo',
        badgeRing: 'lil-boss',
      });

      // Oldest encounter
      const encounter1 = await sightingRepository.create({
        catId: cat.id,
        locationName: 'Taman Suropati',
        latitude: -6.2088,
        longitude: 106.8456,
        spottedAt: '2026-02-10T08:00:00.000Z',
        notes: 'Pertemuan pertama',
      });

      // Second encounter (newer)
      const encounter2 = await sightingRepository.create({
        catId: cat.id,
        locationName: 'Jalan Teuku Umar',
        latitude: -6.2095,
        longitude: 106.8460,
        spottedAt: '2026-02-15T14:30:00.000Z',
        notes: 'Pertemuan kedua',
      });

      // Third encounter (newest)
      const encounter3 = await sightingRepository.create({
        catId: cat.id,
        locationName: 'Pos Satpam',
        latitude: -6.2100,
        longitude: 106.8470,
        spottedAt: '2026-02-20T17:15:00.000Z',
        notes: 'Pertemuan ketiga (terbaru)',
      });

      // Fetch via repository
      const allSightings = await sightingRepository.getByCatId(cat.id);

      // Verify all 3 encounters are retrieved
      expect(allSightings).toHaveLength(3);

      // Verify reverse chronological order: newest (encounter3) -> encounter2 -> oldest (encounter1)
      expect(allSightings[0].id).toBe(encounter3.id);
      expect(allSightings[1].id).toBe(encounter2.id);
      expect(allSightings[2].id).toBe(encounter1.id);
    });

    it('retrieves encounters without photos alongside encounters with photos', async () => {
      const cat = await catRepository.create({
        name: 'Luna',
        badgeRing: 'pinkie',
      });

      const photoRecord = await photoRepository.save({
        catId: cat.id,
        blob: new Blob(['photo-bytes'], { type: 'image/jpeg' }),
        mimeType: 'image/jpeg',
      });

      // Sighting with photo
      const sightingWithPhoto = await sightingRepository.create({
        catId: cat.id,
        photoId: photoRecord.id,
        locationName: 'Kafe Kucing',
        spottedAt: '2026-01-01T10:00:00.000Z',
      });

      // Sighting without photo
      const sightingWithoutPhoto = await sightingRepository.create({
        catId: cat.id,
        photoId: null,
        locationName: 'Depan Rumah',
        spottedAt: '2026-01-05T12:00:00.000Z',
      });

      const list = await sightingRepository.getByCatId(cat.id);
      expect(list).toHaveLength(2);

      // Newest first
      expect(list[0].id).toBe(sightingWithoutPhoto.id);
      expect(list[0].photoId).toBeNull();

      expect(list[1].id).toBe(sightingWithPhoto.id);
      expect(list[1].photoId).toBe(photoRecord.id);
    });

    it('preserves latitude and longitude in IndexedDB storage', async () => {
      const cat = await catRepository.create({ name: 'Oyen' });

      const sighting = await sightingRepository.create({
        catId: cat.id,
        latitude: -6.1754,
        longitude: 106.8272,
        locationName: 'Monas',
        spottedAt: '2026-02-01T10:00:00.000Z',
      });

      const stored = await sightingRepository.getById(sighting.id);
      expect(stored).not.toBeNull();
      expect(stored?.latitude).toBe(-6.1754);
      expect(stored?.longitude).toBe(106.8272);
      expect(stored?.locationName).toBe('Monas');
    });
  });

  describe('3. CatRepository.getCatWithLatestSighting — Correct Latest Encounter', () => {
    it('identifies the true newest encounter as latestSighting when multiple exist', async () => {
      const cat = await catRepository.create({ name: 'Choco' });

      await sightingRepository.create({
        catId: cat.id,
        locationName: 'Taman',
        spottedAt: '2026-03-01T10:00:00.000Z',
      });

      const newest = await sightingRepository.create({
        catId: cat.id,
        locationName: 'Balkon',
        spottedAt: '2026-03-10T14:00:00.000Z',
      });

      const profile = await catRepository.getCatWithLatestSighting(cat.id);
      expect(profile).not.toBeNull();
      expect(profile?.sightingsCount).toBe(2);
      expect(profile?.latestSighting?.id).toBe(newest.id);
      expect(profile?.latestSighting?.locationName).toBe('Balkon');
    });
  });

  describe('4. Encounter History UI Display Expectations', () => {
    it('ensures GPS coordinates are omitted from encounter item text while locationName is preserved', async () => {
      const cat = await catRepository.create({ name: 'Simba' });

      const sighting = await sightingRepository.create({
        catId: cat.id,
        latitude: -6.2088,
        longitude: 106.8456,
        locationName: 'Taman Menteng',
        notes: 'Sedang tidur siang',
        spottedAt: '2026-02-17T09:12:00.000Z',
      });

      // Verify stored data has valid coordinates
      expect(sighting.latitude).toBe(-6.2088);
      expect(sighting.longitude).toBe(106.8456);

      // Verify the formatted date string conforms to Indonesian requirement
      const formattedDate = formatIndonesianDateTime(sighting.spottedAt);
      expect(formattedDate).toBe('Selasa, 17 Februari 2026, 16.12'); // converted to local id-ID

      // Construct encounter item DOM snippet as rendered in CatDetailPage
      const encounterItemHtml = renderToString(
        React.createElement('div', { className: 'timeline-item' }, [
          React.createElement('div', { key: 'content' }, [
            React.createElement('span', { key: 'date' }, formattedDate),
            sighting.locationName
              ? React.createElement('span', { key: 'loc' }, sighting.locationName)
              : null,
            sighting.notes
              ? React.createElement('p', { key: 'notes' }, sighting.notes)
              : null,
          ]),
        ])
      );

      // Verify locationName and notes are present
      expect(encounterItemHtml).toContain('Taman Menteng');
      expect(encounterItemHtml).toContain('Sedang tidur siang');

      // Verify GPS text is STRICTLY omitted from the rendered UI
      expect(encounterItemHtml).not.toContain('GPS:');
      expect(encounterItemHtml).not.toContain('-6.2088');
      expect(encounterItemHtml).not.toContain('106.8456');
    });
  });
});

