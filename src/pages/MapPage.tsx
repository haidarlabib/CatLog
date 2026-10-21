import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { 
  Plus,
  Minus,
  Navigation, 
  ZoomIn,
  ZoomOut,
  MapPin, 
  X, 
  Footprints, 
  ArrowRight,
  AlertCircle,
  WifiOff,
  Camera
} from 'lucide-react';
import { defaultMapConfig } from '../config/mapConfig';
import { mapService, type MapMarkerData } from '../services/mapService';
import { 
  getCurrentDeviceLocation, 
  groupMarkersBy50mRadius, 
  isValidCoordinates,
  type GeoLocationResult,
  type MarkerGroup 
} from '../utils/geo';
import { resolveBadge, formatBreedLabel, formatCatTraitLine } from '../config/catAppearance';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { useUserProfile, type UserProfile } from '../utils/useUserProfile';
import { OyenEmptyState } from '../components/OyenEmptyState';

export type LocationCycleState = 'idle' | 'user-nearby' | 'user-max-detail';

export const ZOOM_OVERVIEW = 13;
export const ZOOM_NEARBY = 16.5;
export const ZOOM_MAX_DETAIL = 19;

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

function renderCatCardPhoto(marker: MapMarkerData | undefined): string {
  if (!marker || !marker.photoUrl) {
    return `
      <div class="cat-stack-card-fallback">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/>
          <path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/>
        </svg>
      </div>
    `;
  }

  const focalX = marker.focalX ?? 0.5;
  const focalY = marker.focalY ?? 0.5;
  const zoom = marker.zoom ?? 1.0;
  const objectPosition = `${(focalX * 100).toFixed(1)}% ${(focalY * 100).toFixed(1)}%`;
  const transform = zoom > 1.001 ? `transform: scale(${zoom.toFixed(2)}); transform-origin: ${objectPosition};` : '';

  return `<img src="${marker.photoUrl}" alt="${marker.catName}" class="cat-stack-card-img" style="object-position: ${objectPosition}; ${transform}" />`;
}

function createStackedClusterIcon(group: MarkerGroup): L.DivIcon {
  const count = group.markers.length;
  const markerFront = group.markers[0];
  const markerBack = group.markers[1] || group.markers[0];

  const stackHtml = `
    <div class="cat-stack-pin-container" id="cluster-${group.id}">
      <div class="cat-stack-cards-wrapper">
        <div class="cat-stack-card cat-stack-card-back">
          ${renderCatCardPhoto(markerBack)}
        </div>
        <div class="cat-stack-card cat-stack-card-front">
          ${renderCatCardPhoto(markerFront)}
        </div>
        <div class="cat-stack-badge" title="${count} kucing di lokasi ini">
          <svg class="cat-stack-badge-icon" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true">
            <path d="M18.5 7.5c-.8 0-1.4.3-1.9.8l-.5-1.4c-.2-.5-.7-.8-1.3-.8h-3.4c-.6 0-1.2.3-1.5.8L10 8.8H7.8c-.4-.7-.9-1.2-1.5-1.6l1.2-3.5c.1-.4 0-.8-.3-1.1-.3-.3-.7-.4-1.1-.3L3.8 3 2.6 1.3C2.4 1 2 .9 1.6 1c-.4.2-.6.5-.6.9l.4 4.8C.8 7.6.4 8.9.4 10.4c0 3.6 2.7 6.5 6.2 6.5h1.2l.6 4c.1.6.6 1 1.2 1s1.1-.4 1.2-1l.8-5h3l.8 5c.1.6.6 1 1.2 1s1.1-.4 1.2-1l.7-4.2c1.7-.8 2.9-2.5 2.9-4.5 0-1.2-.4-2.2-1-3l.8-1.8c.4-.9-.3-2-1.4-2zm-3.5 1.5c.3 0 .5.2.5.5v1c0 1.1-.9 2-2 2h-1c-.6 0-1-.4-1-1s.4-1 1-1h1v-1c0-.3.2-.5.5-.5z"/>
          </svg>
          <span class="cat-stack-badge-count">${count}</span>
        </div>
      </div>
      <div class="cat-stack-pointer-arrow"></div>
    </div>
  `;

  return L.divIcon({
    className: 'cat-cluster-stack-container',
    html: stackHtml,
    iconSize: [68, 70],
    iconAnchor: [34, 70],
    popupAnchor: [0, -70],
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

  // 3-Stage Location Zoom Cycle: 'idle' -> 'user-nearby' -> 'user-max-detail' -> 'idle'
  const [locationCycleState, setLocationCycleState] = useState<LocationCycleState>('idle');
  const preCycleCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  // 1. Load Sighting Markers from Database
  const loadMarkers = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const markers = await mapService.getMapMarkers();
      
      // Preserve existing valid Blob URLs to prevent net::ERR_FILE_NOT_FOUND on active pins
      const nextUrls = new Map<string, string>();
      for (const m of markers) {
        if (!m.photoBlob) continue;
        const existing = blobUrlsRef.current.get(m.sightingId);
        if (existing) {
          nextUrls.set(m.sightingId, existing);
        } else if (typeof URL !== 'undefined' && URL.createObjectURL) {
          nextUrls.set(m.sightingId, URL.createObjectURL(m.photoBlob));
        }
      }

      // Revoke only sighting URLs that were removed
      for (const [id, url] of blobUrlsRef.current.entries()) {
        if (!nextUrls.has(id)) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // Safe ignore
          }
        }
      }
      blobUrlsRef.current = nextUrls;

      // Attach transient URLs
      const enriched = markers.map((m) => ({
        ...m,
        photoUrl: nextUrls.get(m.sightingId),
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
    const initialZoom = cachedMapViewState?.zoom ?? ZOOM_OVERVIEW;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter as L.LatLngExpression,
      zoom: initialZoom,
      minZoom: defaultMapConfig.minZoom,
      maxZoom: defaultMapConfig.maxZoom,
      zoomControl: false,
      attributionControl: false,
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

    // Reset location cycle state to idle when user manually drags/pans map away
    map.on('dragstart', () => {
      setLocationCycleState('idle');
      preCycleCameraRef.current = null;
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
  }, []);

  // Update user avatar marker when profile changes without tearing down the entire map
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setIcon(createUserAvatarIcon(profile));
      const pos = lastKnownUserPosRef.current || cachedUserLocation;
      if (pos) {
        userMarkerRef.current.bindPopup(`
          <div class="user-map-popup">
            <strong>${profile.nickname || 'Cat Explorer'}</strong>
            <small>Lokasi Anda saat ini (±${pos.accuracy}m)</small>
          </div>
        `);
      }
    }
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

  // 3-State GPS Location Toggle:
  // Stage 1 ('idle' -> 'user-nearby'): Locate & Zoom In to nearby area (ZOOM_NEARBY = 16.5)
  // Stage 2 ('user-nearby' -> 'user-max-detail'): Zoom In closer to maximum realistic detail (ZOOM_MAX_DETAIL = 19)
  // Stage 3 ('user-max-detail' -> 'idle'): Zoom Out to wider view (ZOOM_OVERVIEW = 13 or snapshot) and reset
  const handleLocationCycleClick = async () => {
    const map = mapInstanceRef.current;
    if (!map || geoLoading) return;

    // Halt any in-flight Leaflet animation to prevent animation queueing or inconsistent state
    map.stop();

    if (locationCycleState === 'idle') {
      // --- TAHAP 1: Locate & Zoom In to Nearby Area ---
      // Save camera snapshot before moving (for Stage 3 return if needed)
      preCycleCameraRef.current = {
        center: [map.getCenter().lat, map.getCenter().lng],
        zoom: map.getZoom(),
      };

      let userPos = lastKnownUserPosRef.current || cachedUserLocation;

      if (!userPos || !isValidCoordinates(userPos.latitude, userPos.longitude)) {
        setGeoLoading(true);
        setGeoNotice(null);
        try {
          const freshPos = await getCurrentDeviceLocation();
          if (!isValidCoordinates(freshPos.latitude, freshPos.longitude)) {
            throw new Error('Koordinat lokasi tidak valid.');
          }
          userPos = freshPos;
          cachedUserLocation = freshPos;
          lastKnownUserPosRef.current = freshPos;
        } catch (err: unknown) {
          const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Lokasi tidak tersedia.';
          setGeoNotice(msg);
          setTimeout(() => setGeoNotice(null), 4000);
          setGeoLoading(false);
          // Do not advance cycle state if geolocation fails
          return;
        } finally {
          setGeoLoading(false);
        }
      }

      hasInitialFitRef.current = true;

      // Add or update personal avatar marker
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([userPos.latitude, userPos.longitude], {
          icon: createUserAvatarIcon(profile),
          zIndexOffset: 1500,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([userPos.latitude, userPos.longitude]);
        userMarkerRef.current.setIcon(createUserAvatarIcon(profile));
      }

      const popupHtml = `
        <div class="user-map-popup">
          <strong>${profile.nickname || 'Cat Explorer'}</strong>
          <small>Lokasi Anda saat ini (±${userPos.accuracy}m)</small>
        </div>
      `;
      userMarkerRef.current.bindPopup(popupHtml);

      // Smoothly zoom in to nearby detail (never zoom out here)
      map.flyTo([userPos.latitude, userPos.longitude], ZOOM_NEARBY, {
        animate: true,
        duration: 0.6,
      });

      cachedMapViewState = {
        center: [userPos.latitude, userPos.longitude],
        zoom: ZOOM_NEARBY,
      };

      setLocationCycleState('user-nearby');

    } else if (locationCycleState === 'user-nearby') {
      // --- TAHAP 2: Maximum Detail ---
      const userPos = lastKnownUserPosRef.current || cachedUserLocation;
      if (!userPos || !isValidCoordinates(userPos.latitude, userPos.longitude)) {
        setLocationCycleState('idle');
        return;
      }

      hasInitialFitRef.current = true;

      // Retain user coordinate as center, zoom-in closer to realistic maximum (19) without new GPS call
      map.flyTo([userPos.latitude, userPos.longitude], ZOOM_MAX_DETAIL, {
        animate: true,
        duration: 0.5,
      });

      cachedMapViewState = {
        center: [userPos.latitude, userPos.longitude],
        zoom: ZOOM_MAX_DETAIL,
      };

      setLocationCycleState('user-max-detail');

    } else if (locationCycleState === 'user-max-detail') {
      // --- TAHAP 3: Zoom Out & Reset Cycle ---
      const snapshot = preCycleCameraRef.current;
      const userPos = lastKnownUserPosRef.current || cachedUserLocation;

      // Prioritize restoring camera position before cycle started if broad (< 15)
      const targetCenter: [number, number] = (snapshot && snapshot.zoom < 15)
        ? snapshot.center
        : (userPos ? [userPos.latitude, userPos.longitude] : defaultMapConfig.defaultCenter);
      const targetZoom = (snapshot && snapshot.zoom < 15)
        ? snapshot.zoom
        : ZOOM_OVERVIEW;

      map.flyTo(targetCenter, targetZoom, {
        animate: true,
        duration: 0.6,
      });

      cachedMapViewState = {
        center: targetCenter,
        zoom: targetZoom,
      };

      // Reset camera snapshot and return cycle state to idle
      preCycleCameraRef.current = null;
      setLocationCycleState('idle');
    }
  };

  // Background auto-location on initial map mount: places avatar marker and keeps user coordinates fresh
  const autoLocateOnMount = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const cached = lastKnownUserPosRef.current || cachedUserLocation;
    if (cached && isValidCoordinates(cached.latitude, cached.longitude)) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([cached.latitude, cached.longitude], {
          icon: createUserAvatarIcon(profile),
          zIndexOffset: 1500,
        }).addTo(map);
      }
    }

    try {
      const pos = await getCurrentDeviceLocation();
      if (!isValidCoordinates(pos.latitude, pos.longitude)) return;

      cachedUserLocation = pos;
      lastKnownUserPosRef.current = pos;

      if (!userMarkerRef.current && mapInstanceRef.current) {
        userMarkerRef.current = L.marker([pos.latitude, pos.longitude], {
          icon: createUserAvatarIcon(profile),
          zIndexOffset: 1500,
        }).addTo(mapInstanceRef.current);
      } else if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([pos.latitude, pos.longitude]);
        userMarkerRef.current.setIcon(createUserAvatarIcon(profile));
      }

      if (userMarkerRef.current) {
        const popupHtml = `
          <div class="user-map-popup">
            <strong>${profile.nickname || 'Cat Explorer'}</strong>
            <small>Lokasi Anda saat ini (±${pos.accuracy}m)</small>
          </div>
        `;
        userMarkerRef.current.bindPopup(popupHtml);
      }
    } catch {
      // Silent graceful fallback for background auto-locate
    }
  }, [profile]);

  useEffect(() => {
    loadMarkers();
    autoLocateOnMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="map-page-container" id="map-page">
      {/* Map Canvas */}
      <div className="map-container-full">
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} id="leaflet-map-canvas" />

        {/* Floating Zoom Controls: Zoom In & Zoom Out pill (Top Left per Mockup Screen 1) */}
        <div className="map-zoom-pill" id="map-zoom-pill" aria-label="Kontrol Perbesaran Peta">
          <button
            type="button"
            className="map-zoom-btn"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            aria-label="Perbesar peta"
            title="Perbesar peta"
            id="btn-map-zoom-in"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            className="map-zoom-btn"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            aria-label="Perkecil peta"
            title="Perkecil peta"
            id="btn-map-zoom-out"
          >
            <Minus size={18} />
          </button>
        </div>

        {/* Floating Controls: GPS My Location 3-State Toggle Button */}
        <button
          type="button"
          className={`map-my-location-btn ${
            locationCycleState === 'user-nearby'
              ? 'map-my-location-btn--nearby'
              : locationCycleState === 'user-max-detail'
              ? 'map-my-location-btn--max'
              : ''
          }`}
          onClick={handleLocationCycleClick}
          disabled={geoLoading}
          aria-label={
            locationCycleState === 'idle'
              ? 'Pusatkan dan zoom ke lokasi saya'
              : locationCycleState === 'user-nearby'
              ? 'Perbesar ke detail maksimal'
              : 'Perluas tampilan peta'
          }
          title={
            locationCycleState === 'idle'
              ? 'Pusatkan ke lokasi saya'
              : locationCycleState === 'user-nearby'
              ? 'Perbesar detail maksimal'
              : 'Perluas tampilan peta'
          }
          id="btn-map-my-location"
        >
          {geoLoading ? (
            <Navigation size={18} className="animate-spin" />
          ) : locationCycleState === 'user-nearby' ? (
            <ZoomIn size={18} />
          ) : locationCycleState === 'user-max-detail' ? (
            <ZoomOut size={18} />
          ) : (
            <Navigation size={18} />
          )}
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
            aria-label="Ambil foto kucing baru"
            id="global-quick-capture-fab"
          >
            <Camera size={26} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
