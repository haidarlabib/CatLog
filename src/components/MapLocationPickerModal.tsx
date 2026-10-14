import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { X, Check, Navigation, MapPin } from 'lucide-react';
import { defaultMapConfig } from '../config/mapConfig';
import { getCurrentDeviceLocation, reverseGeocode, formatCoordinates, isValidCoordinates } from '../utils/geo';

interface MapLocationPickerModalProps {
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (coords: { latitude: number; longitude: number; address?: string | null }) => void;
  onClose: () => void;
}

export const MapLocationPickerModal: React.FC<MapLocationPickerModalProps> = ({
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const hasInitialCoords =
    initialLat !== null &&
    initialLng !== null &&
    isValidCoordinates(initialLat, initialLng);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
    hasInitialCoords ? { lat: initialLat!, lng: initialLng! } : null
  );
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const createPinIcon = () =>
    L.divIcon({
      className: 'manual-picker-pin-icon',
      html: `
        <div style="
          width: 34px;
          height: 34px;
          background: #226F80;
          color: #FFFFFF;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(34, 111, 128, 0.4);
          border: 2px solid #FFFFFF;
        ">
          <div style="width: 10px; height: 10px; background: #FFFFFF; border-radius: 50%;"></div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

  const resolvePointAddress = async (lat: number, lng: number) => {
    setIsResolvingAddress(true);
    try {
      const addr = await reverseGeocode(lat, lng);
      setResolvedAddress(addr);
    } catch {
      setResolvedAddress(null);
    } finally {
      setIsResolvingAddress(false);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const startCenter: [number, number] = hasInitialCoords
      ? [initialLat!, initialLng!]
      : defaultMapConfig.defaultCenter;
    const startZoom = hasInitialCoords ? 17 : defaultMapConfig.defaultZoom;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: startCenter,
      zoom: startZoom,
      zoomControl: false,
    });

    // Add Tile Layer with proper attribution
    L.tileLayer(defaultMapConfig.tileProvider.url, {
      attribution: defaultMapConfig.tileProvider.attribution,
      maxZoom: defaultMapConfig.tileProvider.maxZoom,
      subdomains: defaultMapConfig.tileProvider.subdomains || ['a', 'b', 'c'],
    }).addTo(map);

    // Zoom control at top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    // If initial coordinates exist, place marker and resolve address
    if (hasInitialCoords) {
      markerRef.current = L.marker([initialLat!, initialLng!], { icon: createPinIcon() }).addTo(map);
      resolvePointAddress(initialLat!, initialLng!);
    }

    // Map click listener to place or move pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));

      setSelectedCoords({ lat, lng });
      setGeoError(null);

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon: createPinIcon() }).addTo(map);
      }

      resolvePointAddress(lat, lng);
    });

    // Force map size invalidation after modal render
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const handleUseGPS = async () => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const pos = await getCurrentDeviceLocation();
      setSelectedCoords({ lat: pos.latitude, lng: pos.longitude });

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([pos.latitude, pos.longitude], 17);

        if (markerRef.current) {
          markerRef.current.setLatLng([pos.latitude, pos.longitude]);
        } else {
          markerRef.current = L.marker([pos.latitude, pos.longitude], { icon: createPinIcon() }).addTo(mapInstanceRef.current);
        }
      }

      resolvePointAddress(pos.latitude, pos.longitude);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'GPS tidak tersedia.';
      setGeoError(msg);
    } finally {
      setGeoLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedCoords && isValidCoordinates(selectedCoords.lat, selectedCoords.lng)) {
      onConfirm({
        latitude: selectedCoords.lat,
        longitude: selectedCoords.lng,
        address: resolvedAddress,
      });
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ padding: 'var(--space-2)' }}>
      <div
        className="modal-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '85vh',
          maxHeight: '680px',
          padding: '0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface)',
            zIndex: 10,
          }}
        >
          <div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'bold' }}>Pilih Titik di Peta</h3>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Ketuk peta untuk menandai titik lokasi yang tepat
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            aria-label="Tutup"
            style={{ padding: '6px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Map Container */}
        <div style={{ flex: 1, position: 'relative', width: '100%' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} id="manual-picker-map" />

          {/* Floating Controls inside map */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxWidth: '85%',
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={handleUseGPS}
              disabled={geoLoading}
              style={{
                fontSize: 'var(--font-size-xs)',
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(4px)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Navigation size={13} className={geoLoading ? 'animate-spin' : ''} />
              <span>{geoLoading ? 'Mencari GPS...' : 'Ke Lokasi GPS'}</span>
            </button>

            {geoError && (
              <span
                style={{
                  fontSize: '11px',
                  background: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-danger)',
                }}
              >
                {geoError}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Bar with Coordinates & Confirm Button */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            zIndex: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            {selectedCoords ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                <span className="geo-badge" style={{ alignSelf: 'flex-start' }}>
                  <MapPin size={12} />
                  <span>{formatCoordinates(selectedCoords.lat, selectedCoords.lng)}</span>
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {isResolvingAddress ? 'Mencari alamat...' : resolvedAddress || 'Alamat belum tersedia'}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Belum ada titik yang ditandai di peta
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ fontSize: 'var(--font-size-sm)', padding: '8px 14px' }}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedCoords}
              onClick={handleConfirm}
              style={{ fontSize: 'var(--font-size-sm)', padding: '8px 16px', width: 'auto' }}
              id="btn-confirm-pin"
            >
              <Check size={16} />
              <span>Gunakan Titik Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
