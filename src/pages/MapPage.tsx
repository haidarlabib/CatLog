import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { 
  Plus, 
  Navigation, 
  MapPin, 
  Calendar, 
  X, 
  Footprints, 
  ArrowRight,
  AlertCircle,
  WifiOff
} from 'lucide-react';
import { defaultMapConfig } from '../config/mapConfig';
import { mapService, type MapMarkerData } from '../services/mapService';
import { getCurrentDeviceLocation } from '../utils/geo';

export const MapPage: React.FC = () => {
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Keep track of created Blob URLs for cleanup
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  const [markersData, setMarkersData] = useState<MapMarkerData[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  // 1. Load Sighting Markers from Database
  const loadMarkers = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const markers = await mapService.getMapMarkers();
      
      // Cleanup previous Blob URLs
      mapService.revokeMarkerPhotoUrls(blobUrlsRef.current);

      // Create new Blob URLs
      const urls = mapService.createMarkerPhotoUrls(markers);
      blobUrlsRef.current = urls;

      // Attach transient URLs
      const enriched = markers.map((m) => ({
        ...m,
        photoUrl: urls.get(m.sightingId),
      }));

      setMarkersData(enriched);
    } catch {
      setErrorMsg('Failed to load cat sightings onto map.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: defaultMapConfig.defaultCenter,
      zoom: defaultMapConfig.defaultZoom,
      minZoom: defaultMapConfig.minZoom,
      maxZoom: defaultMapConfig.maxZoom,
      zoomControl: false,
    });

    // Tile Layer with attribution
    L.tileLayer(defaultMapConfig.tileProvider.url, {
      attribution: defaultMapConfig.tileProvider.attribution,
      maxZoom: defaultMapConfig.tileProvider.maxZoom,
      subdomains: defaultMapConfig.tileProvider.subdomains || ['a', 'b', 'c'],
    }).addTo(map);

    // Zoom controls positioned at top-left
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Marker Layer Group
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    mapInstanceRef.current = map;

    // Map click outside marker closes preview card
    map.on('click', () => {
      setSelectedMarker(null);
    });

    // Invalidate size once rendered
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      mapService.revokeMarkerPhotoUrls(blobUrlsRef.current);
    };
  }, []);

  // Listen for online / offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 3. Render Leaflet Markers whenever markersData changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (markersData.length === 0) return;

    const latLngBounds: L.LatLngExpression[] = [];

    markersData.forEach((marker) => {
      const isSelected = selectedMarker?.sightingId === marker.sightingId;
      latLngBounds.push([marker.latitude, marker.longitude]);

      const photoContent = marker.photoUrl
        ? `<img src="${marker.photoUrl}" alt="${marker.catName}" />`
        : `<div class="fallback-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-9 4c-3 0-5 2-5 5 0 2 2 3 5 3s5-1 5-3c0-3-2-5-5-5z"/></svg></div>`;

      const customIcon = L.divIcon({
        className: 'cat-map-marker-container',
        html: `
          <div class="cat-photo-marker-pin ${isSelected ? 'selected' : ''}" id="marker-${marker.sightingId}">
            <div class="cat-photo-marker-circle">
              ${photoContent}
            </div>
            <div class="cat-photo-marker-arrow"></div>
          </div>
        `,
        iconSize: [46, 52],
        iconAnchor: [23, 52],
      });

      const leafletMarker = L.marker([marker.latitude, marker.longitude], {
        icon: customIcon,
        title: marker.catName,
      });

      leafletMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedMarker(marker);
        map.panTo([marker.latitude, marker.longitude], { animate: true });
      });

      layer.addLayer(leafletMarker);
    });

    // Auto fit bounds to markers if available
    if (latLngBounds.length > 0) {
      map.fitBounds(latLngBounds as L.LatLngBoundsExpression, {
        padding: [60, 60],
        maxZoom: 15,
      });
    }
  }, [markersData, selectedMarker]);

  // Load data on component mount
  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  // Handle GPS Centering
  const handleCenterOnUser = async () => {
    setGeoLoading(true);
    setGeoNotice(null);

    try {
      const pos = await getCurrentDeviceLocation();
      const map = mapInstanceRef.current;
      if (!map) return;

      map.setView([pos.latitude, pos.longitude], 16, { animate: true });

      // Add or update pulsing user dot
      if (!userMarkerRef.current) {
        const userIcon = L.divIcon({
          className: 'user-gps-pulse-container',
          html: `
            <div class="user-gps-pulse-marker">
              <div class="user-gps-pulse-ring"></div>
              <div class="user-gps-pulse-dot"></div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        userMarkerRef.current = L.marker([pos.latitude, pos.longitude], {
          icon: userIcon,
          zIndexOffset: 1500,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([pos.latitude, pos.longitude]);
      }

      setGeoNotice(`Centered to your location (±${pos.accuracy}m)`);
      setTimeout(() => setGeoNotice(null), 3500);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Location unavailable.';
      setGeoNotice(msg);
      setTimeout(() => setGeoNotice(null), 4000);
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <div className="map-page-container" id="map-page">
      {/* Map Canvas */}
      <div className="map-container-full">
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} id="leaflet-map-canvas" />

        {/* Floating Controls: GPS My Location Button */}
        <button
          type="button"
          className="map-my-location-btn"
          onClick={handleCenterOnUser}
          disabled={geoLoading}
          aria-label="Center map on my location"
          id="btn-map-my-location"
          title="Center on my location"
        >
          <Navigation size={18} className={geoLoading ? 'animate-spin' : ''} />
        </button>

        {/* GPS Status Toast */}
        {geoNotice && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'rgba(41, 37, 33, 0.92)',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 'var(--font-size-xs)',
              boxShadow: 'var(--shadow-sm)',
              pointerEvents: 'none',
              maxWidth: '90%',
              textAlign: 'center',
            }}
          >
            {geoNotice}
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div
            className="info-banner"
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              zIndex: 1000,
              backgroundColor: 'var(--color-danger-bg)',
              borderColor: 'var(--color-danger)',
            }}
          >
            <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
            <span style={{ color: 'var(--color-danger)' }}>{errorMsg}</span>
          </div>
        )}

        {/* Offline Map Tiles Notice */}
        {!isOnline && (
          <div
            className="info-banner"
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              zIndex: 999,
              backgroundColor: 'rgba(250, 248, 242, 0.95)',
              borderColor: 'var(--color-coral)',
              boxShadow: 'var(--shadow-sm)',
            }}
            role="status"
            id="map-offline-banner"
          >
            <WifiOff size={16} style={{ color: 'var(--color-coral)', flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-main)', fontSize: 'var(--font-size-xs)' }}>
              Offline mode: Map tiles cannot be fetched. Your saved cat markers remain accessible.
            </span>
          </div>
        )}

        {/* Empty State Overlay if no sightings with coordinates */}
        {!isLoading && markersData.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-4)',
              pointerEvents: 'none',
              zIndex: 500,
            }}
          >
            <div
              className="empty-state-card"
              style={{ pointerEvents: 'auto', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)' }}
              id="map-empty-state"
            >
              <div className="empty-state-icon-circle">
                <Footprints size={28} />
              </div>
              <h2 className="empty-state-title">No Mapped Sightings Yet</h2>
              <p className="empty-state-desc">
                When you encounter cats and record their coordinates, their circular photo pins will appear right here on your atlas.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate('/cats/new')}
                id="map-add-first-cat-btn"
              >
                <Plus size={18} />
                <span>Log Cat with Location</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Sighting Floating Preview Card */}
      {selectedMarker && (
        <div className="map-sighting-card-wrapper" id="map-preview-card-wrapper">
          <div className="map-sighting-card" id="map-sighting-card">
            <div className="map-card-thumb">
              {selectedMarker.photoUrl ? (
                <img src={selectedMarker.photoUrl} alt={selectedMarker.catName} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                  <Footprints size={22} />
                </div>
              )}
            </div>

            <div className="map-card-info">
              <div className="map-card-name">{selectedMarker.catName}</div>
              <div className="map-card-meta">
                <Calendar size={11} />
                <span>
                  {new Date(selectedMarker.spottedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {selectedMarker.locationName && (
                <div className="map-card-meta">
                  <MapPin size={11} />
                  <span>{selectedMarker.locationName}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', width: 'auto' }}
                onClick={() => navigate(`/cats/${selectedMarker.catId}`)}
                id="btn-view-cat-from-map"
              >
                <span>Details</span>
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px', borderRadius: '50%' }}
                onClick={() => setSelectedMarker(null)}
                aria-label="Close card"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) for Quick Capture per PRD FR-01 */}
      {!selectedMarker && (
        <div className="fab-container">
          <button
            type="button"
            className="fab-button"
            onClick={() => navigate('/cats/new')}
            aria-label="Add new cat or sighting"
            id="global-quick-capture-fab"
          >
            <Plus size={20} />
            <span>Log Cat</span>
          </button>
        </div>
      )}
    </div>
  );
};
