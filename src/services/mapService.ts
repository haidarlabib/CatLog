import {
  ProwlLogDatabase,
  db as defaultDb,
  CatRepository,
  SightingRepository,
  PhotoRepository,
} from '../db';
import type { Sighting } from '../types';

export interface MapMarkerData {
  sightingId: string;
  catId: string;
  catName: string;
  catBreed?: string;
  coatColors?: string[];
  patterns?: string[];
  badgeRing?: string;
  latitude: number;
  longitude: number;
  locationName?: string | null;
  spottedAt: string;
  notes?: string;
  photoBlob?: Blob | null;
  photoUrl?: string;
  focalX?: number | null;
  focalY?: number | null;
  zoom?: number | null;
}

export class MapService {
  private sightingRepository: SightingRepository;
  private catRepository: CatRepository;
  private photoRepository: PhotoRepository;

  constructor(db: ProwlLogDatabase = defaultDb) {
    this.sightingRepository = new SightingRepository(db);
    this.catRepository = new CatRepository(db);
    this.photoRepository = new PhotoRepository(db);
  }

  /**
   * Fetches all valid map markers by joining sightings, cats, and photo blobs.
   * Filters out any sightings without valid coordinates or orphaned records.
   */
  async getMapMarkers(): Promise<MapMarkerData[]> {
    const sightingsWithCoords: Sighting[] = await this.sightingRepository.getAllWithCoordinates();
    const markers: MapMarkerData[] = [];

    for (const sighting of sightingsWithCoords) {
      if (
        sighting.latitude === null ||
        sighting.longitude === null ||
        isNaN(sighting.latitude) ||
        isNaN(sighting.longitude)
      ) {
        continue;
      }

      // Fetch corresponding cat
      const cat = await this.catRepository.getById(sighting.catId);
      if (!cat) {
        // Orphaned sighting whose cat was deleted; skip
        continue;
      }

      // Fetch photo Blob: prioritize sighting's own photo, fallback to cat cover photo
      const photoId = sighting.photoId || cat.coverPhotoId;
      let photoBlob: Blob | null = null;
      let focalX: number | null = null;
      let focalY: number | null = null;
      let zoom: number | null = null;

      if (photoId) {
        const photo = await this.photoRepository.getById(photoId);
        if (photo?.blob) {
          photoBlob = photo.blob;
          focalX = photo.focalX ?? 0.5;
          focalY = photo.focalY ?? 0.5;
          zoom = photo.zoom ?? 1.0;
        }
      }

      markers.push({
        sightingId: sighting.id,
        catId: cat.id,
        catName: cat.name,
        catBreed: cat.breed && cat.breed !== 'unknown' && cat.breed !== 'Not sure yet' ? cat.breed : undefined,
        coatColors: cat.coatColors && cat.coatColors.length > 0 ? cat.coatColors : undefined,
        patterns: cat.patterns && cat.patterns.length > 0 ? cat.patterns : undefined,
        badgeRing: cat.badgeRing,
        latitude: sighting.latitude,
        longitude: sighting.longitude,
        locationName: sighting.locationName,
        spottedAt: sighting.spottedAt,
        notes: sighting.notes,
        photoBlob,
        focalX,
        focalY,
        zoom,
      });
    }

    return markers;
  }

  /**
   * Generates transient Object URLs for markers with Blobs.
   */
  createMarkerPhotoUrls(markers: MapMarkerData[]): Map<string, string> {
    const urls = new Map<string, string>();
    for (const m of markers) {
      if (m.photoBlob && typeof URL !== 'undefined' && URL.createObjectURL) {
        urls.set(m.sightingId, URL.createObjectURL(m.photoBlob));
      }
    }
    return urls;
  }

  /**
   * Revokes all generated Object URLs to avoid memory leaks.
   */
  revokeMarkerPhotoUrls(urlMap: Map<string, string>): void {
    if (typeof URL === 'undefined' || !URL.revokeObjectURL) return;
    for (const url of urlMap.values()) {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }
    urlMap.clear();
  }
}

export const mapService = new MapService();
