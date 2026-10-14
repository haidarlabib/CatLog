import JSZip from 'jszip';
import {
  ProwlLogDatabase,
  db as defaultDb,
} from '../db';
import type {
  Cat,
  Sighting,
  CatPhoto,
  FeedingLog,
  AppSetting,
} from '../types';

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupManifest {
  app: string;
  version: string;
  schemaVersion: number;
  exportedAt: string;
  counts: {
    cats: number;
    sightings: number;
    photos: number;
    feedingLogs: number;
    settings: number;
  };
}

export interface BackupPhotoMetadata {
  id: string;
  catId: string;
  sightingId?: string | null;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  zoom?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
}

export interface BackupData {
  cats: Cat[];
  sightings: Sighting[];
  photos: BackupPhotoMetadata[];
  feedingLogs: FeedingLog[];
  settings: AppSetting[];
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  manifest?: BackupManifest;
  data?: BackupData;
  photoBlobs?: Map<string, Blob>;
  conflictCounts?: {
    existingCats: number;
    existingSightings: number;
  };
}

export class BackupService {
  private db: ProwlLogDatabase;

  constructor(db: ProwlLogDatabase = defaultDb) {
    this.db = db;
  }

  /**
   * Exports all local database records and photos into a structured ZIP file.
   */
  async exportBackup(): Promise<Blob> {
    const cats = await this.db.cats.toArray();
    const sightings = await this.db.sightings.toArray();
    const photos = await this.db.photos.toArray();
    const feedingLogs = await this.db.feeding_logs.toArray();
    const settings = await this.db.settings.toArray();

    const manifest: BackupManifest = {
      app: 'ProwlLog',
      version: '0.1.0',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      counts: {
        cats: cats.length,
        sightings: sightings.length,
        photos: photos.length,
        feedingLogs: feedingLogs.length,
        settings: settings.length,
      },
    };

    const photosMeta: BackupPhotoMetadata[] = photos.map((p) => ({
      id: p.id,
      catId: p.catId,
      sightingId: p.sightingId,
      mimeType: p.mimeType,
      width: p.width,
      height: p.height,
      focalX: p.focalX ?? 0.5,
      focalY: p.focalY ?? 0.5,
      zoom: p.zoom ?? 1.0,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      createdAt: p.createdAt,
    }));

    const data: BackupData = {
      cats,
      sightings,
      photos: photosMeta,
      feedingLogs,
      settings,
    };

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('data.json', JSON.stringify(data, null, 2));

    const photosFolder = zip.folder('photos');
    for (const p of photos) {
      if (p.blob && photosFolder) {
        photosFolder.file(p.id, p.blob);
      }
    }

    return await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  /**
   * Helper to trigger a browser file download.
   */
  triggerDownload(blob: Blob, customFilename?: string): void {
    if (typeof window === 'undefined') return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = customFilename || `prowllog-backup-${dateStr}.zip`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /**
   * Validates a backup archive file without applying any changes to the database.
   */
  async validateBackupFile(file: File | Blob): Promise<BackupValidationResult> {
    try {
      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(file);
      } catch {
        return {
          isValid: false,
          error: 'Corrupted or invalid ZIP archive file.',
        };
      }

      // 1. Verify manifest.json
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        return {
          isValid: false,
          error: 'Invalid backup: missing manifest.json in archive.',
        };
      }

      let manifest: BackupManifest;
      try {
        const text = await manifestFile.async('text');
        manifest = JSON.parse(text);
      } catch {
        return {
          isValid: false,
          error: 'Invalid backup: manifest.json is corrupted or not valid JSON.',
        };
      }

      if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) {
        return {
          isValid: false,
          error: `Unsupported backup schema version: ${manifest.schemaVersion}. This app supports version ${BACKUP_SCHEMA_VERSION}.`,
        };
      }

      // 2. Verify data.json
      const dataFile = zip.file('data.json');
      if (!dataFile) {
        return {
          isValid: false,
          error: 'Invalid backup: missing data.json in archive.',
        };
      }

      let data: BackupData;
      try {
        const text = await dataFile.async('text');
        data = JSON.parse(text);
      } catch {
        return {
          isValid: false,
          error: 'Invalid backup: data.json is corrupted or not valid JSON.',
        };
      }

      if (
        !Array.isArray(data.cats) ||
        !Array.isArray(data.sightings) ||
        !Array.isArray(data.photos)
      ) {
        return {
          isValid: false,
          error: 'Invalid backup structure: cats, sightings, or photos are missing or not arrays.',
        };
      }

      // Verify basic record integrity
      for (const cat of data.cats) {
        if (!cat.id || !cat.name) {
          return {
            isValid: false,
            error: 'Invalid cat record in backup: missing required id or name.',
          };
        }
      }

      for (const sighting of data.sightings) {
        if (!sighting.id || !sighting.catId) {
          return {
            isValid: false,
            error: 'Invalid sighting record in backup: missing required id or catId.',
          };
        }
      }

      // 3. Extract photos
      const photoBlobs = new Map<string, Blob>();
      const photosFolder = zip.folder('photos');
      if (photosFolder) {
        for (const photoMeta of data.photos) {
          const pFile = photosFolder.file(photoMeta.id);
          if (pFile) {
            const buf = await pFile.async('arraybuffer');
            const blob = new Blob([buf], { type: photoMeta.mimeType || 'image/jpeg' });
            photoBlobs.set(photoMeta.id, blob);
          }
        }
      }

      // 4. Check ID conflicts with existing database
      let existingCats = 0;
      let existingSightings = 0;

      for (const cat of data.cats) {
        const exists = await this.db.cats.get(cat.id);
        if (exists) existingCats++;
      }

      for (const sighting of data.sightings) {
        const exists = await this.db.sightings.get(sighting.id);
        if (exists) existingSightings++;
      }

      return {
        isValid: true,
        manifest,
        data,
        photoBlobs,
        conflictCounts: {
          existingCats,
          existingSightings,
        },
      };
    } catch (err) {
      return {
        isValid: false,
        error: `Unexpected error during backup validation: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Restores a previously validated backup using an atomic Dexie transaction.
   * If any step throws an error, the database rolls back to its exact previous state.
   */
  async restoreBackup(
    validationResult: BackupValidationResult,
    strategy: 'replace' | 'merge' = 'replace'
  ): Promise<{
    restoredCats: number;
    restoredSightings: number;
    restoredPhotos: number;
    restoredFeedingLogs: number;
  }> {
    if (!validationResult.isValid || !validationResult.data) {
      throw new Error(validationResult.error || 'Cannot restore an invalid backup.');
    }

    const { cats, sightings, photos, feedingLogs = [], settings = [] } = validationResult.data;
    const photoBlobs = validationResult.photoBlobs || new Map<string, Blob>();

    // Reconstruct full CatPhoto objects with their Blobs
    const photosToSave: CatPhoto[] = photos.map((meta) => {
      const blob = photoBlobs.get(meta.id) || new Blob([], { type: meta.mimeType || 'image/jpeg' });
      return {
        id: meta.id,
        catId: meta.catId,
        sightingId: meta.sightingId ?? null,
        blob,
        mimeType: meta.mimeType,
        width: meta.width ?? null,
        height: meta.height ?? null,
        focalX: meta.focalX ?? 0.5,
        focalY: meta.focalY ?? 0.5,
        zoom: meta.zoom ?? 1.0,
        latitude: meta.latitude ?? null,
        longitude: meta.longitude ?? null,
        createdAt: meta.createdAt,
      };
    });

    return await this.db.transaction(
      'rw',
      [
        this.db.cats,
        this.db.sightings,
        this.db.photos,
        this.db.feeding_logs,
        this.db.settings,
      ],
      async () => {
        if (strategy === 'replace') {
          // Clear all existing stores
          await this.db.cats.clear();
          await this.db.sightings.clear();
          await this.db.photos.clear();
          await this.db.feeding_logs.clear();
          await this.db.settings.clear();

          // Atomic bulk adds
          if (cats.length > 0) await this.db.cats.bulkAdd(cats);
          if (sightings.length > 0) await this.db.sightings.bulkAdd(sightings);
          if (photosToSave.length > 0) await this.db.photos.bulkAdd(photosToSave);
          if (feedingLogs.length > 0) await this.db.feeding_logs.bulkAdd(feedingLogs);
          if (settings.length > 0) await this.db.settings.bulkAdd(settings);
        } else {
          // Merge strategy: upsert (put) records safely
          if (cats.length > 0) await this.db.cats.bulkPut(cats);
          if (sightings.length > 0) await this.db.sightings.bulkPut(sightings);
          if (photosToSave.length > 0) await this.db.photos.bulkPut(photosToSave);
          if (feedingLogs.length > 0) await this.db.feeding_logs.bulkPut(feedingLogs);
          if (settings.length > 0) await this.db.settings.bulkPut(settings);
        }

        return {
          restoredCats: cats.length,
          restoredSightings: sightings.length,
          restoredPhotos: photosToSave.length,
          restoredFeedingLogs: feedingLogs.length,
        };
      }
    );
  }
}

export const backupService = new BackupService();
