import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { 
  Plus, 
  Navigation, 
  MapPin, 
  X, 
  Footprints, 
  ArrowRight,
  AlertCircle,
  WifiOff
} from 'lucide-react';
import { defaultMapConfig } from '../config/mapConfig';
import { mapService, type MapMarkerData } from '../services/mapService';
import { 
  getCurrentDeviceLocation, 
  groupMarkersBy50mRadius, 
  computeClusterStackModel, 
  isValidCoordinates,
  type GeoLocationResult,
  type MarkerGroup 
} from '../utils/geo';
import { resolveBadge, formatBreedLabel, formatCatTraitLine } from '../config/catAppearance';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { useUserProfile, type UserProfile } from '../utils/useUserProfile';
import { OyenEmptyState } from '../components/OyenEmptyState';

// Persist last map center and zoom level across route transitions
let cachedMapViewState: { center: [number, number]; zoom: number } | null = null;
let cachedUserLocation: GeoLocationResult | null = null;

function createUserAvatarIcon(profile: UserProfile): L.DivIcon {
  const nickname = profile.nickname || 'Cat Explorer';
  const escapedName = nickname.replace(/"/g, '&quot;');
  const initials = nickname
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || 'U';

  const avatarInner = profile.photoUrl
    ? `<img src="${profile.photoUrl}" alt="${escapedName}" class="user-avatar-img" />`
    : `<span class="user-avatar-initials">${initials}</span>`;

  const frameClass = profile.photoUrl ? 'user-avatar-frame' : 'user-avatar-frame user-avatar-frame--initials';

  const html = `
    <div class="user-avatar-marker" title="${escapedName}" id="user-location-avatar">
      <div class="user-avatar-nickname-pill">${escapedName}</div>
      <div class="user-avatar-body">
        <div class="${frameClass}">
          ${avatarInner}
        </div>
        <div class="user-avatar-pointer"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'user-avatar-container',
    html,
    iconSize: [70, 63],
    iconAnchor: [35, 63],
    popupAnchor: [0, -63],
  });
}

function renderCatPhotoCircle(marker: MapMarkerData, sizePx = 40): string {
  const badge = resolveBadge(marker.badgeRing);
  const focalX = marker.focalX ?? 0.5;
  const focalY = marker.focalY ?? 0.5;
  const zoom = marker.zoom ?? 1.0;
  const objectPosition = `${(focalX * 100).toFixed(1)}% ${(focalY * 100).toFixed(1)}%`;
  const transform = zoom > 1.001 ? `transform: scale(${zoom.toFixed(2)}); transform-origin: ${objectPosition};` : '';

  const photoContent = marker.photoUrl
    ? `<img src="${marker.photoUrl}" alt="${marker.catName}" style="object-position: ${objectPosition}; ${transform}" />`
    : `<div class="fallback-icon" style="color: ${badge.hex}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-9 4c-3 0-5 2-5 5 0 2 2 3 5 3s5-1 5-3c0-3-2-5-5-5z"/></svg></div>`;

  const cal = badge.calibration;

  return `
    <div class="cat-stacked-photo-item" style="width: ${sizePx}px; height: ${sizePx}px;">
      <div class="cat-photo-marker-frame-wrap" style="width: ${sizePx}px; height: ${sizePx}px;">
        <div class="cat-photo-marker-inner-circle" style="width: ${cal.photoDiameter}%; height: ${cal.photoDiameter}%; top: ${cal.photoCenterY}%; left: ${cal.photoCenterX}%;">
          ${photoContent}
        </div>
        <img class="cat-photo-marker-badge-img" src="${badge.assetPath}" alt="${badge.nickname}" style="transform: scale(${cal.frameScale});" />
      </div>
    </div>
  `;
}

function createCatMarkerIcon(marker: MapMarkerData, isSelected = false): L.DivIcon {
  const badge = resolveBadge(marker.badgeRing);
  return L.divIcon({
    className: 'cat-map-marker-container',
    html: `
      <div class="cat-photo-marker-pin${isSelected ? ' selected' : ''}" id="marker-${marker.sightingId}">
        ${renderCatPhotoCircle(marker, 52)}
        <div class="cat-photo-marker-arrow" style="border-top-color: ${badge.hex};"></div>
      </div>
    `,
    iconSize: [52, 57],
    iconAnchor: [26, 57],
  });
}

export function createStackedClusterIcon(group: MarkerGroup): L.DivIcon {
  const count = group.markers.length;
  const stackModel = computeClusterStackModel(count);
  const displayedMarkers = group.markers.slice(0, stackModel.displayedCount);

  let stackHtml = '';
  let iconWidth = 62;
  let iconHeight = 48;
  let anchorX = 31;
  let anchorY = 24;

  const itemSize = count === 2 ? 42 : 40;

  if (count === 2) {
    iconWidth = 62;
    iconHeight = 48;
    anchorX = 31;
    anchorY = 24;

    stackHtml = `
      <div class="cat-cluster-stack cat-cluster-stack-2" id="cluster-${group.id}">
        <div class="cat-cluster-stack-slot slot-0" style="left: 0px; top: 0px; z-index: 1;">
          ${renderCatPhotoCircle(displayedMarkers[0], itemSize)}
        </div>
        <div class="cat-cluster-stack-slot slot-1" style="left: 20px; top: 6px; z-index: 2;">
          ${renderCatPhotoCircle(displayedMarkers[1], itemSize)}
        </div>
      </div>
    `;
  } else {
    // 3 or more cats
    iconWidth = 68;
    iconHeight = 56;
    anchorX = 34;
    anchorY = 28;

    const extraBadgeHtml = stackModel.hasExtra
      ? `<div class="cat-cluster-extra-badge" title="${count} kucing di area ini">${stackModel.extraLabel}</div>`
      : '';

    stackHtml = `
      <div class="cat-cluster-stack cat-cluster-stack-multi" id="cluster-${group.id}">
        <div class="cat-cluster-stack-slot slot-0" style="left: 0px; top: 0px; z-index: 1;">
          ${renderCatPhotoCircle(displayedMarkers[0], itemSize)}
        </div>
        <div class="cat-cluster-stack-slot slot-1" style="left: 26px; top: 0px; z-index: 1;">
          ${renderCatPhotoCircle(displayedMarkers[1], itemSize)}
        </div>
        <div class="cat-cluster-stack-slot slot-2" style="left: 13px; top: 15px; z-index: 2;">
          ${renderCatPhotoCircle(displayedMarkers[2], itemSize)}
        </div>
        ${extraBadgeHtml}
      </div>
    `;
  }

  return L.divIcon({
    className: 'cat-cluster-stack-container',
    html: stackHtml,
    iconSize: [iconWidth, iconHeight],
    iconAnchor: [anchorX, anchorY],
  });
}

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const lastKnownUserPosRef = useRef<GeoLocationResult | null>(null);
  const hasInitialFitRef = useRef(false);
  const markersInstancesRef = useRef<Map<string, L.Marker>>(new Map());

  // Keep track of created Blob URLs for cleanup
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  const [markersData, setMarkersData] = useState<MapMarkerData[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerData | null>(null);
  const [spiderfiedGroupId, setSpiderfiedGroupId] = useState<string | null>(null);
  const [areaCatListGroup, setAreaCatListGroup] = useState<MarkerGroup | null>(null);
  const [mapVersion, setMapVersion] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
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
      setErrorMsg('Gagal memuat lokasi kucing ke peta.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter = (cachedUserLocation && isValidCoordinates(cachedUserLocation.latitude, cachedUserLocation.longitude))
      ? [cachedUserLocation.latitude, cachedUserLocation.longitude]
      : (cachedMapViewState?.center ?? defaultMapConfig.defaultCenter);
    const initialZoom = cachedUserLocation ? 17 : (cachedMapViewState?.zoom ?? defaultMapConfig.defaultZoom);

    const map = L.map(mapContainerRef.current, {
      center: initialCenter as L.LatLngExpression,
      zoom: initialZoom,
      minZoom: defaultMapConfig.minZoom,
      maxZoom: defaultMapConfig.maxZoom,
      zoomControl: false,
    });

    // If cached location already exists, place avatar marker immediately
    if (cachedUserLocation && isValidCoordinates(cachedUserLocation.latitude, cachedUserLocation.longitude)) {
      hasInitialFitRef.current = true;
      userMarkerRef.current = L.marker([cachedUserLocation.latitude, cachedUserLocation.longitude], {
        icon: createUserAvatarIcon(profile),
        zIndexOffset: 1500,
      }).addTo(map);
    }

    // CARTO Voyager Tile Layer with attribution
    const tileLayer = L.tileLayer(defaultMapConfig.tileProvider.url, {
      attribution: defaultMapConfig.tileProvider.attribution,
      maxZoom: defaultMapConfig.tileProvider.maxZoom,
      maxNativeZoom: defaultMapConfig.tileProvider.maxNativeZoom ?? 18,
      subdomains: defaultMapConfig.tileProvider.subdomains || ['a', 'b', 'c', 'd'],
    });

    tileLayer.on('tileerror', () => {
      setTileError(true);
    });

    tileLayer.on('load', () => {
      setTileError(false);
    });

    tileLayer.addTo(map);

    // Zoom controls positioned at top-left
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Marker Layer Group
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    mapInstanceRef.current = map;

    // Map click outside marker closes preview card & spiderfy
    map.on('click', () => {
      setSelectedMarker(null);
      setSpiderfiedGroupId(null);
      setAreaCatListGroup(null);
    });

    // Track zoom and move to recalculate clusters dynamically & cache view state
    map.on('zoomend moveend', () => {
      cachedMapViewState = {
        center: [map.getCenter().lat, map.getCenter().lng],
        zoom: map.getZoom(),
      };
      setMapVersion((v) => v + 1);
    });

    // Invalidate size on initial mount and when container dimensions change
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    // Initial size invalidation check
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      if (mapInstanceRef.current) {
        cachedMapViewState = {
          center: [mapInstanceRef.current.getCenter().lat, mapInstanceRef.current.getCenter().lng],
          zoom: mapInstanceRef.current.getZoom(),
        };
      }
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      markersInstancesRef.current.clear();
      userMarkerRef.current = null;
      mapService.revokeMarkerPhotoUrls(blobUrlsRef.current);
    };
  }, [profile]);

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

  // 3. Render Leaflet Markers, Clusters & Spiderfy
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markersInstancesRef.current.clear();

    if (markersData.length === 0) return;

    // Strict geographic clustering (< 50 meters, non-chaining)
    const groups = groupMarkersBy50mRadius(markersData);


    const latLngBounds: L.LatLngExpression[] = [];

    groups.forEach((group) => {
      // 1) Single Marker
      if (group.markers.length === 1) {
        const marker = group.markers[0];
        latLngBounds.push([marker.latitude, marker.longitude]);

        const customIcon = createCatMarkerIcon(marker, selectedMarker?.sightingId === marker.sightingId);
        const leafletMarker = L.marker([marker.latitude, marker.longitude], {
          icon: customIcon,
          title: marker.catName,
          zIndexOffset: selectedMarker?.sightingId === marker.sightingId ? 2000 : 0,
        });

        leafletMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedMarker(marker);
          setAreaCatListGroup(null);
          setSpiderfiedGroupId(null);

          const currentZoom = map.getZoom();
          const targetZoom = Math.max(currentZoom, 17);
          map.flyTo([marker.latitude, marker.longitude], targetZoom, {
            animate: true,
            duration: 0.5,
          });
        });

        layer.addLayer(leafletMarker);
        markersInstancesRef.current.set(marker.sightingId, leafletMarker);
        return;
      }

      // 2) Multi-Marker Cluster
      group.markers.forEach((m) => {
        latLngBounds.push([m.latitude, m.longitude]);
      });

      // If this group is currently spiderfied
      if (spiderfiedGroupId === group.id) {
        const centerPt = map.latLngToLayerPoint(group.centerLatLng);
        const N = group.markers.length;
        const radius = N <= 2 ? 46 : N <= 4 ? 54 : N <= 8 ? 64 : 76;

        // Central hub button to collapse spiderfy
        const centerHubIcon = L.divIcon({
          className: 'cat-spider-center-hub-container',
          html: `
            <div class="cat-spider-center-hub" title="Tutup sebaran kucing">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const hubMarker = L.marker(group.centerLatLng, {
          icon: centerHubIcon,
          zIndexOffset: 2500,
        });

        hubMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSpiderfiedGroupId(null);
          setAreaCatListGroup(null);
        });

        layer.addLayer(hubMarker);

        // Render each spiderfied cat pin & connector line
        group.markers.forEach((m, idx) => {
          const angle = (2 * Math.PI * idx) / N - Math.PI / 2;
          const spiderPt = centerPt.add(L.point(Math.cos(angle) * radius, Math.sin(angle) * radius));
          const spiderLatLng = map.layerPointToLatLng(spiderPt);

          // Connecting line
          const line = L.polyline([group.centerLatLng, spiderLatLng], {
            color: '#237787',
            weight: 2,
            opacity: 0.6,
            dashArray: '3, 4',
          });
          layer.addLayer(line);

          // Pin
          const customIcon = createCatMarkerIcon(m, selectedMarker?.sightingId === m.sightingId);
          const leafletMarker = L.marker(spiderLatLng, {
            icon: customIcon,
            title: m.catName,
            zIndexOffset: selectedMarker?.sightingId === m.sightingId ? 2000 : 1200,
          });

          leafletMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            setSelectedMarker(m);
            setAreaCatListGroup(null);
          });

          layer.addLayer(leafletMarker);
          markersInstancesRef.current.set(m.sightingId, leafletMarker);
        });

        return;
      }

      // Normal Cluster Pin (stacked cat photo miniature markers)
      const clusterIcon = createStackedClusterIcon(group);

      const clusterMarker = L.marker(group.centerLatLng, {
        icon: clusterIcon,
        title: `${group.markers.length} Kucing di area ini`,
        zIndexOffset: 800,
      });

      clusterMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        const currentZoom = map.getZoom();
        const maxClusterZoom = 18;

        // Jika lokasi anggotanya berbeda dan masih memungkinkan untuk diperbesar, zoom-in serta pusatkan peta pada area cluster
        if (!group.isIdenticalCoords && currentZoom < maxClusterZoom) {
          const bounds = L.latLngBounds(group.markers.map((m) => [m.latitude, m.longitude]));
          const targetZoom = Math.min(map.getBoundsZoom(bounds, false, L.point(60, 60)), maxClusterZoom);

          if (targetZoom > currentZoom) {
            map.flyToBounds(bounds, {
              padding: [60, 60],
              maxZoom: maxClusterZoom,
              duration: 0.5,
            });
            return;
          }
        }

        // Jika koordinat sama atau peta sudah mencapai tingkat zoom maksimum yang sesuai, buka daftar
        setSpiderfiedGroupId(group.id);
        setAreaCatListGroup(group);
        setSelectedMarker(null);
        map.panTo(group.centerLatLng, { animate: true });
      });

      layer.addLayer(clusterMarker);
    });

    // Auto fit bounds to markers ONCE on initial data load (only if no user location is active)
    if (!cachedUserLocation && !lastKnownUserPosRef.current && !cachedMapViewState && !hasInitialFitRef.current && latLngBounds.length > 0) {
      hasInitialFitRef.current = true;
      const size = map.getSize();
      if (size.x > 80 && size.y > 80) {
        try {
          map.fitBounds(latLngBounds as L.LatLngBoundsExpression, {
            padding: [40, 40],
            maxZoom: 15,
          });
        } catch {
          // Graceful fallback
        }
      }
    }
  }, [markersData, mapVersion, spiderfiedGroupId, selectedMarker?.sightingId]);

  // 4. Update visual selection & z-index when selectedMarker changes
  useEffect(() => {
    // Reset selected class on DOM pins
    document.querySelectorAll('.cat-photo-marker-pin.selected').forEach((el) => {
      el.classList.remove('selected');
    });

    // Reset marker z-index offsets
    markersInstancesRef.current.forEach((m) => {
      m.setZIndexOffset(0);
    });

    if (selectedMarker) {
      const pin = document.getElementById(`marker-${selectedMarker.sightingId}`);
      if (pin) {
        pin.classList.add('selected');
      }
      const leafletMarker = markersInstancesRef.current.get(selectedMarker.sightingId);
      if (leafletMarker) {
        leafletMarker.setZIndexOffset(2000);
      }
    }
  }, [selectedMarker]);

  // Handle GPS Centering & Auto-location
  const centerOnUserLocation = useCallback(async (isManualTrigger = false) => {
    setGeoLoading(true);
    if (isManualTrigger) {
      setGeoNotice(null);
    }

    const map = mapInstanceRef.current;
    if (!map) {
      setGeoLoading(false);
      return;
    }

    // Reuse existing valid location immediately if available (fast response without zoom-out)
    const existing = lastKnownUserPosRef.current || cachedUserLocation;
    if (
      existing &&
      isValidCoordinates(existing.latitude, existing.longitude)
    ) {
      hasInitialFitRef.current = true;
      const currentZoom = map.getZoom();
      const targetZoom = Math.max(currentZoom, 17);
      map.flyTo([existing.latitude, existing.longitude], targetZoom, {
        animate: true,
        duration: 0.5,
      });
      cachedMapViewState = {
        center: [existing.latitude, existing.longitude],
        zoom: targetZoom,
      };

      // Add or update avatar marker immediately
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([existing.latitude, existing.longitude], {
          icon: createUserAvatarIcon(profile),
          zIndexOffset: 1500,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([existing.latitude, existing.longitude]);
        userMarkerRef.current.setIcon(createUserAvatarIcon(profile));
      }
    }

    try {
      const pos = await getCurrentDeviceLocation();
      if (!isValidCoordinates(pos.latitude, pos.longitude)) {
        throw new Error('Koordinat lokasi tidak valid.');
      }

      cachedUserLocation = pos;
      lastKnownUserPosRef.current = pos;
      hasInitialFitRef.current = true;

      const currentZoom = map.getZoom();
      const targetZoom = Math.max(currentZoom, 17);

      map.flyTo([pos.latitude, pos.longitude], targetZoom, {
        animate: true,
        duration: 0.7,
      });

      cachedMapViewState = {
        center: [pos.latitude, pos.longitude],
        zoom: targetZoom,
      };

      // Add or update personal avatar marker
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([pos.latitude, pos.longitude], {
          icon: createUserAvatarIcon(profile),
          zIndexOffset: 1500,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([pos.latitude, pos.longitude]);
        userMarkerRef.current.setIcon(createUserAvatarIcon(profile));
      }

      const popupHtml = `
        <div class="user-map-popup">
          <strong>${profile.nickname || 'Cat Explorer'}</strong>
          <small>Lokasi Anda saat ini (±${pos.accuracy}m)</small>
        </div>
      `;
      userMarkerRef.current.bindPopup(popupHtml);
    } catch (err: unknown) {
      if (isManualTrigger) {
        const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Lokasi tidak tersedia.';
        setGeoNotice(msg);
        setTimeout(() => setGeoNotice(null), 4000);
      }
    } finally {
      setGeoLoading(false);
    }
  }, [profile]);

  // Load data & auto-locate user on every map open
  useEffect(() => {
    loadMarkers();
    centerOnUserLocation(false);
  }, [loadMarkers, centerOnUserLocation]);

  const handleCenterOnUser = () => {
    centerOnUserLocation(true);
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
          aria-label="Pusatkan ke lokasi saya"
          id="btn-map-my-location"
          title="Pusatkan ke lokasi saya"
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
              Mode luring: Ubin peta tidak dapat dimuat. Penanda kucing yang tersimpan tetap dapat diakses.
            </span>
          </div>
        )}

        {/* Transient Tile Error Notice while online */}
        {tileError && isOnline && (
          <div
            className="info-banner"
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              zIndex: 998,
              backgroundColor: 'rgba(250, 248, 242, 0.95)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
            role="status"
            id="map-tile-error-banner"
          >
            <AlertCircle size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}>
              Sebagian ubin peta terkendala. Penanda kucing yang tersimpan tetap aktif.
            </span>
          </div>
        )}

        {/* Empty State Overlay with Oyen Si Penasaran if no sightings with coordinates */}
        {!isLoading && !errorMsg && !tileError && markersData.length === 0 && (
          <OyenEmptyState
            variant="penasaran"
            title="Peta masih sepi, nih!"
            description="Yuk, tandai kucing pertama yang kamu temui."
            ctaLabel="Tambah Kucing"
            onCtaClick={() => navigate('/cats/new')}
            overlay
          />
        )}
      </div>

      {/* Area Cat List Bottom Sheet / Panel */}
      {areaCatListGroup && (
        <div className="area-cat-list-panel" id="area-cat-list-panel">
          <div className="area-cat-list-header">
            <div className="area-cat-list-title">
              <Footprints size={16} style={{ color: 'var(--color-primary)' }} />
              <span>Kucing di sekitar sini ({areaCatListGroup.markers.length})</span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '5px', borderRadius: '50%' }}
              onClick={() => {
                setAreaCatListGroup(null);
                setSpiderfiedGroupId(null);
              }}
              aria-label="Tutup daftar kucing"
              id="btn-close-area-cat-list"
            >
              <X size={15} />
            </button>
          </div>

          <div className="area-cat-list-body" id="area-cat-list-items">
            {areaCatListGroup.markers.map((m) => {
              const breedLabel = m.catBreed && m.catBreed.trim() && m.catBreed.toLowerCase() !== 'unknown' && m.catBreed.toLowerCase() !== 'not sure yet' ? formatBreedLabel(m.catBreed) : null;
              const displayBreed = breedLabel && breedLabel !== 'Belum tahu pasti' ? breedLabel : null;

              return (
                <div
                  key={m.sightingId}
                  className="area-cat-item-card"
                  onClick={() => {
                    setSelectedMarker(m);
                    setAreaCatListGroup(null);
                  }}
                  id={`area-cat-item-${m.sightingId}`}
                >
                  <div className="area-cat-thumb">
                    <CatPhotoImg
                      src={m.photoUrl}
                      alt={m.catName}
                      mode="circle"
                      badgeId={m.badgeRing}
                      crop={{
                        focalX: m.focalX ?? 0.5,
                        focalY: m.focalY ?? 0.5,
                        zoom: m.zoom ?? 1.0,
                      }}
                    />
                  </div>

                  <div className="area-cat-info">
                    <div className="area-cat-name">{m.catName}</div>
                    {displayBreed && (
                      <div className="area-cat-breed-line">
                        <span>{displayBreed}</span>
                      </div>
                    )}
                    {m.locationName && (
                      <div className="area-cat-address">
                        <MapPin size={10} style={{ flexShrink: 0 }} />
                        <span>{m.locationName}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '11.5px', width: 'auto', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/cats/${m.catId}`);
                    }}
                    id={`btn-detail-area-cat-${m.catId}`}
                  >
                    <span>Detail</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Sighting Floating Preview Card */}
      {selectedMarker && (
        <div className="map-sighting-card-wrapper" id="map-preview-card-wrapper">
          <div className="map-sighting-card" id="map-sighting-card">
            <div className="map-card-thumb">
              <CatPhotoImg
                src={selectedMarker.photoUrl}
                alt={selectedMarker.catName}
                mode="circle"
                badgeId={selectedMarker.badgeRing}
                crop={{
                  focalX: selectedMarker.focalX ?? 0.5,
                  focalY: selectedMarker.focalY ?? 0.5,
                  zoom: selectedMarker.zoom ?? 1.0,
                }}
              />
            </div>

            <div className="map-card-info">
              <div className="map-card-name">{selectedMarker.catName}</div>
              {(() => {
                const traitLine = formatCatTraitLine(
                  selectedMarker.catBreed,
                  selectedMarker.coatColors,
                  selectedMarker.patterns
                );
                return traitLine ? (
                  <div className="map-card-meta map-card-traits">
                    <span>{traitLine}</span>
                  </div>
                ) : null;
              })()}
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
                <span>Detail</span>
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px', borderRadius: '50%' }}
                onClick={() => setSelectedMarker(null)}
                aria-label="Tutup pratinjau"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) for Quick Capture per PRD FR-01 */}
      {!selectedMarker && !areaCatListGroup && (
        <div className="fab-container">
          <button
            type="button"
            className="fab-button"
            onClick={() => navigate('/cats/new')}
            aria-label="Tambah kucing baru"
            id="global-quick-capture-fab"
          >
            <Plus size={20} />
            <span>Tambah Kucing</span>
          </button>
        </div>
      )}
    </div>
  );
};
