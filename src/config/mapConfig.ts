/**
 * Map provider configuration for ProwlLog PWA
 * Keeps tile provider URL and attribution decoupled from map UI logic.
 *
 * Primary style: CARTO Voyager (warm, soft sage green, friendly for community cat tracking)
 * Alternative: CARTO Positron (clean monochrome minimal)
 * Fallback: OpenStreetMap Standard
 */

export interface MapTileProvider {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number;
  minZoom?: number;
  subdomains?: string[];
}

export interface MapConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  tileProvider: MapTileProvider;
  fallbackProvider: MapTileProvider;
  alternativeProviders: MapTileProvider[];
}

// Support Vite environment variable for CARTO API Key with configured default
const CARTO_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CARTO_API_KEY)
  ? (import.meta.env.VITE_CARTO_API_KEY as string).trim()
  : 'cb1_4k57_1_5bf5f1cf0c696dd593a8b5bd';

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

function buildCartoUrl(style: 'voyager' | 'light_all', key?: string): string {
  const base = `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png`;
  const resolvedKey = key && key.trim() ? key.trim() : CARTO_API_KEY;
  if (resolvedKey) {
    return `${base}?key=${encodeURIComponent(resolvedKey)}`;
  }
  return base;
}

/** CARTO Voyager: Vibrant, soft sage parks, clean roads, matching ProwlLog palette */
export const cartoVoyagerProvider: MapTileProvider = {
  id: 'carto-voyager',
  name: 'CARTO Voyager',
  url: buildCartoUrl('voyager', CARTO_API_KEY),
  attribution: CARTO_ATTRIBUTION,
  maxZoom: 20,
  maxNativeZoom: 18,
  minZoom: 1,
  subdomains: ['a', 'b', 'c', 'd'],
};

/** CARTO Positron: Subtle minimal monochrome style */
export const cartoPositronProvider: MapTileProvider = {
  id: 'carto-positron',
  name: 'CARTO Positron',
  url: buildCartoUrl('light_all', CARTO_API_KEY),
  attribution: CARTO_ATTRIBUTION,
  maxZoom: 20,
  maxNativeZoom: 18,
  minZoom: 1,
  subdomains: ['a', 'b', 'c', 'd'],
};

/** OpenStreetMap Standard Fallback */
export const osmFallbackProvider: MapTileProvider = {
  id: 'osm-standard',
  name: 'OpenStreetMap',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: OSM_ATTRIBUTION,
  maxZoom: 19,
  maxNativeZoom: 19,
  minZoom: 1,
  subdomains: ['a', 'b', 'c'],
};

export const defaultMapConfig: MapConfig = {
  // Default fallback center (Jakarta / Indonesia metro area)
  defaultCenter: [-6.2088, 106.8456],
  defaultZoom: 13,
  minZoom: 3,
  maxZoom: 20,
  tileProvider: cartoVoyagerProvider,
  fallbackProvider: osmFallbackProvider,
  alternativeProviders: [cartoPositronProvider, osmFallbackProvider],
};
