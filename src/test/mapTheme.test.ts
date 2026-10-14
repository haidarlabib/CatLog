import { describe, it, expect } from 'vitest';
import {
  defaultMapConfig,
  cartoVoyagerProvider,
  cartoPositronProvider,
  osmFallbackProvider,
} from '../config/mapConfig';

describe('Batch 6.6: CARTO Voyager Map Theme & Configuration', () => {
  it('configures CARTO Voyager as the primary default tile provider with key parameter', () => {
    expect(defaultMapConfig.tileProvider.id).toBe('carto-voyager');
    expect(defaultMapConfig.tileProvider.name).toBe('CARTO Voyager');
    expect(defaultMapConfig.tileProvider.url).toContain('rastertiles/voyager');
    expect(defaultMapConfig.tileProvider.url).toContain('key=');
    expect(defaultMapConfig.tileProvider.maxZoom).toBe(20);
    expect(defaultMapConfig.tileProvider.subdomains).toEqual(['a', 'b', 'c', 'd']);
  });

  it('preserves legally required OpenStreetMap and CARTO attributions', () => {
    const attr = defaultMapConfig.tileProvider.attribution;
    expect(attr).toContain('OpenStreetMap');
    expect(attr).toContain('CARTO');
    expect(attr).toContain('https://www.openstreetmap.org/copyright');
    expect(attr).toContain('https://carto.com/attributions');
  });

  it('provides OpenStreetMap as a supported fallback provider', () => {
    expect(defaultMapConfig.fallbackProvider.id).toBe('osm-standard');
    expect(defaultMapConfig.fallbackProvider.url).toContain('tile.openstreetmap.org');
    expect(defaultMapConfig.fallbackProvider.attribution).toContain('OpenStreetMap');
  });

  it('provides CARTO Positron as a minimal alternative style', () => {
    expect(cartoPositronProvider.id).toBe('carto-positron');
    expect(cartoPositronProvider.url).toContain('rastertiles/light_all');
    expect(cartoPositronProvider.subdomains).toEqual(['a', 'b', 'c', 'd']);
  });

  it('supports maxZoom of at least 19 across all providers for close neighborhood inspection', () => {
    expect(cartoVoyagerProvider.maxZoom).toBeGreaterThanOrEqual(19);
    expect(cartoPositronProvider.maxZoom).toBeGreaterThanOrEqual(19);
    expect(osmFallbackProvider.maxZoom).toBeGreaterThanOrEqual(19);
  });
});
