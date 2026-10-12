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
 * Requests device coordinates via HTML5 Geolocation API on explicit user action.
 */
export function getCurrentDeviceLocation(): Promise<GeoLocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      const err: GeoLocationError = {
        code: 'NOT_SUPPORTED',
        message: 'Geolocation is not supported by your browser.',
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
        let message = 'Unable to determine your location.';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = 'PERMISSION_DENIED';
            message = 'Location access was denied. You can proceed without GPS or enter a location name.';
            break;
          case error.POSITION_UNAVAILABLE:
            code = 'POSITION_UNAVAILABLE';
            message = 'Location information is currently unavailable on your device.';
            break;
          case error.TIMEOUT:
            code = 'TIMEOUT';
            message = 'Location request timed out. Please try again or proceed without coordinates.';
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
