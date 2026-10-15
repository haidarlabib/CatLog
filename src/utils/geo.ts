import exifr from 'exifr';

/**
 * Geolocation helper utility for ProwlLog PWA
 * Handles user-requested location coordinates with explicit error states.
 */

export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeoLocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED';
  message: string;
}

/**
 * Validates that latitude and longitude are valid numbers within geographical bounds
 * and not the (0, 0) "Null Island" coordinate.
 */
export function isValidCoordinates(latitude: unknown, longitude: unknown): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (isNaN(latitude) || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  // Never interpret absent or zero coordinates as valid location
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

/**
 * Requests device coordinates via HTML5 Geolocation API.
 */
export function getCurrentDeviceLocation(): Promise<GeoLocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      const err: GeoLocationError = {
        code: 'NOT_SUPPORTED',
        message: 'Geolokasi tidak didukung oleh peramban ini.',
      };
      reject(err);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
        });
      },
      (error) => {
        let code: GeoLocationError['code'] = 'POSITION_UNAVAILABLE';
        let message = 'Tidak dapat menentukan lokasi perangkat Anda.';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = 'PERMISSION_DENIED';
            message = 'Akses lokasi ditolak. Anda dapat memilih titik manual di peta atau mencoba lagi.';
            break;
          case error.POSITION_UNAVAILABLE:
            code = 'POSITION_UNAVAILABLE';
            message = 'Informasi lokasi saat ini tidak tersedia pada perangkat.';
            break;
          case error.TIMEOUT:
            code = 'TIMEOUT';
            message = 'Permintaan lokasi memakan waktu terlalu lama. Silakan coba lagi.';
            break;
        }

        const geoErr: GeoLocationError = { code, message };
        reject(geoErr);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Reverse geocodes coordinates into a short readable place name using OSM Nominatim.
 * Returns null if network fails, offline, timed out, or unresolvable.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  if (typeof fetch === 'undefined') return null;
  if (!isValidCoordinates(latitude, longitude)) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'id, en',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.address) return null;

    const addr = data.address;
    const road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.street;
    const houseNum = addr.house_number
      ? (/^(no\.?|#)/i.test(addr.house_number) ? addr.house_number : `No. ${addr.house_number}`)
      : undefined;

    const roadPart = road ? (houseNum ? `${road} ${houseNum}` : road) : undefined;

    const mainPlace =
      roadPart ||
      addr.amenity ||
      addr.building ||
      addr.tourism ||
      addr.leisure ||
      addr.neighbourhood ||
      addr.suburb;

    let locality: string | undefined = undefined;
    if (roadPart && addr.neighbourhood && (addr.suburb || addr.city_district)) {
      const secondArea = addr.suburb || addr.city_district;
      if (secondArea.toLowerCase() !== addr.neighbourhood.toLowerCase()) {
        locality = `${addr.neighbourhood}, ${secondArea}`;
      } else {
        locality = addr.neighbourhood;
      }
    } else {
      locality =
        addr.suburb ||
        addr.village ||
        addr.city_district ||
        addr.city ||
        addr.town ||
        addr.county;
    }

    if (mainPlace && locality && mainPlace.toLowerCase() !== locality.toLowerCase()) {
      return `${mainPlace}, ${locality}`;
    }
    if (mainPlace) return mainPlace;
    if (locality) return locality;
    if (data.name) return data.name;

    return null;
  } catch {
    return null;
  }
}

/**
 * Format coordinates consistently as "Lat: -6.2088, Lng: 106.8456"
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
}

/**
 * Safely extracts embedded EXIF GPS coordinates from an image File or Blob.
 * Validates coordinate ranges and rejects invalid/absent coordinates (like 0,0).
 */
export async function extractExifGps(
  file: Blob | File
): Promise<{ latitude: number; longitude: number } | null> {
  if (!file) return null;

  try {
    const gps = await exifr.gps(file);
    if (!gps) return null;

    const lat = typeof gps.latitude === 'number' ? gps.latitude : parseFloat(gps.latitude);
    const lng = typeof gps.longitude === 'number' ? gps.longitude : parseFloat(gps.longitude);

    if (!isValidCoordinates(lat, lng)) {
      return null;
    }

    return {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    };
  } catch {
    return null;
  }
}

/**
 * Calculates geographic distance in meters between two lat/lng coordinates using the Haversine formula.
 */
export function calculateGeoDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371000; // Earth mean radius in meters
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface MarkerGroup<T = any> {
  id: string;
  anchor: [number, number];
  centerLatLng: [number, number];
  markers: T[];
  isIdenticalCoords: boolean;
}

export const CLUSTER_RADIUS_LIMIT_METERS = 50.0;

/**
 * Groups markers strictly by geographic distance < 50 meters.
 * Prevents chaining beyond 50m from cluster reference point.
 */
export function groupMarkersBy50mRadius<T extends { latitude: number; longitude: number; sightingId: string }>(
  markers: T[]
): MarkerGroup<T>[] {
  if (markers.length === 0) return [];

  const groups: MarkerGroup<T>[] = [];

  for (const marker of markers) {
    let bestGroup: MarkerGroup<T> | null = null;
    let minDistance = CLUSTER_RADIUS_LIMIT_METERS;

    for (const g of groups) {
      const distToAnchor = calculateGeoDistanceMeters(
        g.anchor[0],
        g.anchor[1],
        marker.latitude,
        marker.longitude
      );

      // Strict rule: distance must be strictly LESS than 50 meters
      if (distToAnchor < minDistance) {
        // Prevent chaining: every existing member in the group must also be < 50m from candidate
        const allWithin50m = g.markers.every(
          (member) =>
            calculateGeoDistanceMeters(
              member.latitude,
              member.longitude,
              marker.latitude,
              marker.longitude
            ) < CLUSTER_RADIUS_LIMIT_METERS
        );

        if (allWithin50m) {
          minDistance = distToAnchor;
          bestGroup = g;
        }
      }
    }

    if (bestGroup) {
      bestGroup.markers.push(marker);
    } else {
      groups.push({
        id: `cluster-${marker.sightingId}`,
        anchor: [marker.latitude, marker.longitude],
        centerLatLng: [marker.latitude, marker.longitude],
        markers: [marker],
        isIdenticalCoords: true,
      });
    }
  }

  // Calculate centroids & identical check
  for (const g of groups) {
    const first = g.markers[0];
    const isIdentical = g.markers.every(
      (m) =>
        Math.abs(m.latitude - first.latitude) < 0.000001 &&
        Math.abs(m.longitude - first.longitude) < 0.000001
    );
    g.isIdenticalCoords = isIdentical;
    if (isIdentical) {
      g.centerLatLng = [first.latitude, first.longitude];
    } else {
      const avgLat = g.markers.reduce((sum, m) => sum + m.latitude, 0) / g.markers.length;
      const avgLng = g.markers.reduce((sum, m) => sum + m.longitude, 0) / g.markers.length;
      g.centerLatLng = [avgLat, avgLng];
    }
  }

  return groups;
}

export interface ClusterStackModel {
  displayedCount: number;
  extraCount: number;
  hasExtra: boolean;
  extraLabel: string | null;
}

/**
 * Calculates displayed representative photos and +N extra count for stacked cluster markers.
 * - 2 cats -> 2 photos, 0 extra
 * - 3 cats -> 3 photos, 0 extra
 * - >3 cats -> 3 photos, +(total - 3) extra (e.g. 5 cats -> 3 photos, +2)
 */
export function computeClusterStackModel(totalCount: number): ClusterStackModel {
  if (totalCount <= 1) {
    return {
      displayedCount: 1,
      extraCount: 0,
      hasExtra: false,
      extraLabel: null,
    };
  }

  if (totalCount <= 3) {
    return {
      displayedCount: totalCount,
      extraCount: 0,
      hasExtra: false,
      extraLabel: null,
    };
  }

  const displayedCount = 3;
  const extraCount = totalCount - displayedCount;
  return {
    displayedCount,
    extraCount,
    hasExtra: true,
    extraLabel: `+${extraCount}`,
  };
}


