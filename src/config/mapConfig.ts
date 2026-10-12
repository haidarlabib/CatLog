/**
 * Map provider configuration for ProwlLog PWA
 * Keeps tile provider URL and attribution decoupled from map UI logic.
 */

export interface MapTileProvider {
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
}

export interface MapConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  tileProvider: MapTileProvider;
}

/**
 * OpenStreetMap Standard Tile Provider
 * Note: Subject to OSM tile usage policies; easily swappable for production.
 */
export const defaultMapConfig: MapConfig = {
  // Default fallback center (Jakarta / Indonesia metro area)
  defaultCenter: [-6.2088, 106.8456],
  defaultZoom: 13,
  minZoom: 3,
  maxZoom: 19,
  tileProvider: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
};
