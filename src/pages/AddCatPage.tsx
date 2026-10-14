import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import L from 'leaflet';
import { 
  MapPin, 
  Navigation, 
  ArrowLeft, 
  Save, 
  AlertCircle,
  Plus,
  X,
  Sparkles,
  Camera,
  RefreshCw,
  ChevronDown,
  Palette
} from 'lucide-react';
import { defaultMapConfig } from '../config/mapConfig';
import { catService } from '../services/catService';
import { getCurrentDeviceLocation, reverseGeocode, formatCoordinates, isValidCoordinates, type GeoLocationError } from '../utils/geo';
import { MapLocationPickerModal } from '../components/MapLocationPickerModal';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { BadgeSelector } from '../components/BadgeSelector';
import { catDraftStore } from '../utils/catDraftStore';
import { 
  PRESET_COAT_COLORS, 
  PRESET_PATTERNS, 
  BREED_OPTIONS,
  getBadgeColorHex,
  resolveBadge,
  formatAppearanceLabel
} from '../config/catAppearance';

export const AddCatPage: React.FC = () => {
  const navigate = useNavigate();

  // Route & state protection: a valid photo draft is strictly mandatory
  const hasPhoto = catDraftStore.hasPhotoDraft();
  const photoDraft = catDraftStore.getPhotoDraft();

  // Restore preserved form draft if returning from "Ganti Foto"
  const formDraft = catDraftStore.getFormDraft();

  // 1. Lokasi State
  const [latitude, setLatitude] = useState<number | null>(() => {
    if (formDraft && formDraft.latitude !== null) return formDraft.latitude;
    if (photoDraft?.location && isValidCoordinates(photoDraft.location.latitude, photoDraft.location.longitude)) {
      return photoDraft.location.latitude;
    }
    return null;
  });

  const [longitude, setLongitude] = useState<number | null>(() => {
    if (formDraft && formDraft.longitude !== null) return formDraft.longitude;
    if (photoDraft?.location && isValidCoordinates(photoDraft.location.latitude, photoDraft.location.longitude)) {
      return photoDraft.location.longitude;
    }
    return null;
  });

  const [locationName, setLocationName] = useState<string>(() => formDraft?.locationName || '');
  const [locationSource, setLocationSource] = useState<'gps' | 'manual'>(() => formDraft?.locationSource || 'gps');
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // 2. Profil Kucing State
  const [name, setName] = useState(() => formDraft?.name || '');
  const [breed, setBreed] = useState(() => formDraft?.breed || 'unknown');

  // 3. Tampilan: Colour Badge (Wajib dipilih oleh pengguna)
  const [badgeRing, setBadgeRing] = useState<string>(() => formDraft?.badgeRing || '');

  // 4. Tampilan: Warna & Pola Bulu (Opsional & Collapsible)
  const [isAppearanceExpanded, setIsAppearanceExpanded] = useState(false);

  // 4. Tampilan: Warna & Pola Bulu
  const [selectedCoatColors, setSelectedCoatColors] = useState<string[]>(() => formDraft?.coatColors || []);
  const [customCoatColors, setCustomCoatColors] = useState<string[]>([]);
  const [newCoatInput, setNewCoatInput] = useState('');
  const [showAddCoat, setShowAddCoat] = useState(false);

  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(() => formDraft?.patterns || []);
  const [customPatterns, setCustomPatterns] = useState<string[]>([]);
  const [newPatternInput, setNewPatternInput] = useState('');
  const [showAddPattern, setShowAddPattern] = useState(false);

  // 5. Catatan
  const [notes, setNotes] = useState(() => formDraft?.notes || '');

  // Status Form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Leaflet Mini Map Preview refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);
  const hasAutoLocatedRef = useRef(false);

  // Action: Change Photo (Retake) preserving entered form state
  const handleChangePhoto = () => {
    catDraftStore.setFormDraft({
      name,
      breed,
      badgeRing,
      coatColors: selectedCoatColors,
      patterns: selectedPatterns,
      notes,
      latitude,
      longitude,
      locationName,
      locationSource,
    });
    navigate('/cats/new');
  };

  // Resolve location place-name on coordinate change
  const handleLocationResolved = useCallback(async (lat: number, lng: number) => {
    setIsResolvingLocation(true);
    setGeoError(null);
    try {
      const place = await reverseGeocode(lat, lng);
      if (place) {
        setLocationName(place);
      } else {
        setLocationName(formatCoordinates(lat, lng));
      }
    } catch {
      setLocationName(formatCoordinates(lat, lng));
    } finally {
      setIsResolvingLocation(false);
    }
  }, []);

  // Request GPS
  const handleRequestGPS = useCallback(async () => {
    setGeoLoading(true);
    setGeoError(null);

    try {
      const pos = await getCurrentDeviceLocation();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      setLocationSource('gps');
      await handleLocationResolved(pos.latitude, pos.longitude);
    } catch (err: unknown) {
      const geoErr = err as GeoLocationError;
      setGeoError(geoErr.message || 'Gagal mendapatkan lokasi dari perangkat.');
    } finally {
      setGeoLoading(false);
    }
  }, [handleLocationResolved]);

  // Automatic GPS request or place-name resolution on mount
  useEffect(() => {
    if (hasAutoLocatedRef.current) return;
    hasAutoLocatedRef.current = true;

    if (latitude !== null && longitude !== null && isValidCoordinates(latitude, longitude)) {
      if (!locationName) {
        handleLocationResolved(latitude, longitude);
      }
    } else {
      handleRequestGPS();
    }
  }, [latitude, longitude, locationName, handleLocationResolved, handleRequestGPS]);

  // Update Mini Map Preview whenever coordinates, badgeRing, or crop changes
  useEffect(() => {
    if (latitude === null || longitude === null || !isValidCoordinates(latitude, longitude)) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    const badge = resolveBadge(badgeRing);

    const focalX = photoDraft?.crop.focalX ?? 0.5;
    const focalY = photoDraft?.crop.focalY ?? 0.5;
    const zoom = photoDraft?.crop.zoom ?? 1.0;
    const objectPosition = `${(focalX * 100).toFixed(1)}% ${(focalY * 100).toFixed(1)}%`;
    const transform = zoom > 1.001 ? `transform: scale(${zoom.toFixed(2)}); transform-origin: ${objectPosition};` : '';

    const photoContent = photoDraft?.previewUrl
      ? `<img src="${photoDraft.previewUrl}" alt="Marker Foto" style="width: 100%; height: 100%; object-fit: cover; object-position: ${objectPosition}; ${transform}" />`
      : `<div class="fallback-icon" style="color: ${badge.hex};"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-9 4c-3 0-5 2-5 5 0 2 2 3 5 3s5-1 5-3c0-3-2-5-5-5z"/></svg></div>`;

    const customIcon = L.divIcon({
      className: 'cat-map-marker-container',
      html: `
        <div class="cat-photo-marker-pin selected">
          <div class="cat-photo-marker-frame-wrap">
            <div class="cat-photo-marker-inner-circle">
              ${photoContent}
            </div>
            <img class="cat-photo-marker-badge-img" src="${badge.assetPath}" alt="${badge.nickname}" />
          </div>
          <div class="cat-photo-marker-arrow" style="border-top-color: ${badge.hex};"></div>
        </div>
      `,
      iconSize: [50, 56],
      iconAnchor: [25, 56],
    });

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      });

      L.tileLayer(defaultMapConfig.tileProvider.url, {
        maxZoom: defaultMapConfig.tileProvider.maxZoom,
        subdomains: defaultMapConfig.tileProvider.subdomains || ['a', 'b', 'c'],
      }).addTo(map);

      const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
      markerInstanceRef.current = marker;
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([latitude, longitude], 17);
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLatLng([latitude, longitude]);
        markerInstanceRef.current.setIcon(customIcon);
      }
    }

    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
  }, [latitude, longitude, badgeRing]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  // Toggle Coat Color Chip
  const toggleCoatColor = (colorId: string) => {
    setSelectedCoatColors((prev) =>
      prev.includes(colorId) ? prev.filter((c) => c !== colorId) : [...prev, colorId]
    );
  };

  // Add Custom Coat Color
  const handleAddCustomCoat = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCoatInput.trim();
    if (!clean) return;

    if (!selectedCoatColors.includes(clean)) {
      setSelectedCoatColors((prev) => [...prev, clean]);
    }
    if (!customCoatColors.includes(clean)) {
      setCustomCoatColors((prev) => [...prev, clean]);
    }
    setNewCoatInput('');
    setShowAddCoat(false);
  };

  // Remove Custom Coat Color
  const handleRemoveCustomCoat = (color: string) => {
    setSelectedCoatColors((prev) => prev.filter((c) => c !== color));
    setCustomCoatColors((prev) => prev.filter((c) => c !== color));
  };

  // Toggle Pattern Chip
  const togglePattern = (patternId: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(patternId) ? prev.filter((p) => p !== patternId) : [...prev, patternId]
    );
  };

  // Add Custom Pattern
  const handleAddCustomPattern = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPatternInput.trim();
    if (!clean) return;

    if (!selectedPatterns.includes(clean)) {
      setSelectedPatterns((prev) => [...prev, clean]);
    }
    if (!customPatterns.includes(clean)) {
      setCustomPatterns((prev) => [...prev, clean]);
    }
    setNewPatternInput('');
    setShowAddPattern(false);
  };

  // Remove Custom Pattern
  const handleRemoveCustomPattern = (pattern: string) => {
    setSelectedPatterns((prev) => prev.filter((p) => p !== pattern));
    setCustomPatterns((prev) => prev.filter((p) => p !== pattern));
  };

  // If photo draft is missing or invalid, immediately redirect back to camera capture
  if (!hasPhoto || !photoDraft || !photoDraft.blob) {
    return <Navigate to="/cats/new" replace />;
  }

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setFormError('Nama kucing wajib diisi.');
      return;
    }

    // Validate mandatory character badge
    if (!badgeRing) {
      setFormError('Pilih Colour Badge karakter kucing terlebih dahulu.');
      return;
    }

    // Validate mandatory photo draft
    const currentPhoto = catDraftStore.getPhotoDraft();
    if (!currentPhoto || !currentPhoto.blob || currentPhoto.blob.size === 0) {
      setFormError('Foto kucing wajib diambil terlebih dahulu.');
      navigate('/cats/new', { replace: true });
      return;
    }

    // Validate required valid coordinates
    if (
      latitude === null ||
      longitude === null ||
      !isValidCoordinates(latitude, longitude)
    ) {
      setFormError('Lokasi pertemuan awal kucing wajib ditentukan. Izinkan akses GPS atau gunakan "Pilih di Peta".');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const result = await catService.createCatWithFirstSighting({
        name: cleanName,
        breed,
        badgeRing,
        coatColors: selectedCoatColors,
        patterns: selectedPatterns,
        notes: notes.trim() || undefined,
        latitude,
        longitude,
        locationName: locationName.trim() || undefined,
        photoBlob: currentPhoto.blob,
        photoMimeType: currentPhoto.blob.type || 'image/jpeg',
        focalX: currentPhoto.crop.focalX,
        focalY: currentPhoto.crop.focalY,
        zoom: currentPhoto.crop.zoom,
        photoLatitude: currentPhoto.location?.latitude,
        photoLongitude: currentPhoto.location?.longitude,
        fedCat: false,
      });

      // Clear all temporary drafts on successful save
      catDraftStore.clearAllDrafts();

      navigate(`/cats/${result.cat.id}`, {
        state: { flashMessage: `Profil "${cleanName}" berhasil ditambahkan ke Katalog Kucing!` },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan profil kucing.';
      setFormError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container" id="add-cat-page" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 32px)' }}>
      {/* Header Bar */}
      <div className="page-header-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            catDraftStore.clearAllDrafts();
            navigate(-1);
          }}
          aria-label="Kembali"
          style={{ padding: '6px 12px' }}
          id="btn-add-cat-back"
        >
          <ArrowLeft size={16} />
          <span>Kembali</span>
        </button>
        <h1 className="page-title" style={{ fontSize: 'var(--font-size-lg)' }}>Tambah Kucing</h1>
        <div style={{ width: 60 }} />
      </div>

      {formError && (
        <div className="info-banner" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }} role="alert">
          <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
          <span style={{ color: 'var(--color-danger)' }}>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card" id="add-cat-form" style={{ gap: 'var(--space-4)' }}>
        
        {/* 1. Bagian Foto Kucing (Approved Preview - ABOVE Location Section) */}
        <div className="form-group" id="approved-cat-photo-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h2 className="form-section-header" style={{ margin: 0 }}>
              <Camera size={18} style={{ color: 'var(--color-primary)' }} />
              <span>Foto Kucing</span>
            </h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleChangePhoto}
              id="btn-change-photo"
              style={{ fontSize: 'var(--font-size-xs)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <RefreshCw size={13} />
              <span>Ganti Foto</span>
            </button>
          </div>

          <div className="approved-photo-card" id="approved-cat-photo-preview">
            {/* 1:1 Square Profile Preview */}
            <div className="approved-photo-square-container">
              <CatPhotoImg
                src={photoDraft.previewUrl}
                alt="Foto Kucing Terpilih"
                mode="square"
                crop={photoDraft.crop}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* Synchronized Circular Map Marker Preview */}
            <div className="approved-photo-sync-panel">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Penanda Peta
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0' }}>
                <div style={{ width: '56px', height: '56px' }}>
                  <CatPhotoImg
                    src={photoDraft.previewUrl}
                    alt="Penanda Peta"
                    mode="circle"
                    badgeId={badgeRing || null}
                    ringColor={badgeRing ? getBadgeColorHex(badgeRing) : 'var(--color-border)'}
                    crop={photoDraft.crop}
                  />
                </div>
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: `6px solid ${badgeRing ? getBadgeColorHex(badgeRing) : 'var(--color-border)'}`,
                    marginTop: '-2px',
                  }}
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
                {badgeRing
                  ? `${resolveBadge(badgeRing).nickname} — ${resolveBadge(badgeRing).epithet}`
                  : 'Pilih Colour Badge di bawah'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Bagian Lokasi */}
        <div className="form-group" id="add-cat-location-section">
          <h2 className="form-section-header">
            <MapPin size={18} style={{ color: 'var(--color-primary)' }} />
            <span>Lokasi</span>
          </h2>

          {geoLoading && latitude === null ? (
            <div className="location-loading-card" id="location-loading-indicator">
              <div className="location-loading-spinner" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Mendeteksi lokasi...</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Meminta koordinat GPS perangkat Anda</span>
              </div>
            </div>
          ) : latitude !== null && longitude !== null ? (
            <div className="location-compact-card" id="location-compact-preview">
              <div ref={mapContainerRef} className="location-compact-map" id="add-cat-mini-map" />
              <div className="location-compact-info">
                <div className="location-compact-text">
                  <div className="location-status-badge">
                    <Navigation size={12} />
                    <span>{locationSource === 'manual' ? 'Titik di Peta' : 'Lokasi saat ini'}</span>
                  </div>
                  <div className="location-address-line">
                    {isResolvingLocation ? (
                      <span style={{ color: 'var(--color-text-muted)' }}>Mencari alamat...</span>
                    ) : locationName ? (
                      <span>{locationName}</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>Alamat belum tersedia</span>
                    )}
                  </div>
                  <span className="location-coords-subtle">
                    {formatCoordinates(latitude, longitude)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowMapPicker(true)}
                  id="btn-change-location"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px', flexShrink: 0 }}
                >
                  <MapPin size={13} />
                  <span>Ubah Lokasi</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="location-fallback-card" id="location-fallback-box">
              <div className="location-fallback-notice">
                <AlertCircle size={16} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
                    Lokasi belum tersedia
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {geoError || 'Akses lokasi peramban belum diizinkan atau tidak dapat ditentukan.'}
                  </span>
                </div>
              </div>
              <div className="location-fallback-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRequestGPS}
                  disabled={geoLoading}
                  id="btn-retry-gps"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                >
                  <Navigation size={13} className={geoLoading ? 'animate-spin' : ''} />
                  <span>Coba lagi</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowMapPicker(true)}
                  id="btn-pick-on-map"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px', width: 'auto' }}
                >
                  <MapPin size={13} />
                  <span>Pilih di Peta</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* B. Bagian Nama Kucing */}
        <div className="form-group">
          <label htmlFor="cat-name-input" className="form-label">
            Nama Kucing <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            id="cat-name-input"
            className="form-input"
            placeholder="Masukkan nama kucing"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* C. Bagian Ras / Jenis */}
        <div className="form-group">
          <label htmlFor="cat-breed-select" className="form-label">
            Ras / Jenis
          </label>
          <select
            id="cat-breed-select"
            className="form-select"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          >
            {BREED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* D. Colour Badge (Wajib) */}
        <div className="form-group" id="colour-badge-group">
          <h2 className="form-section-header">
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            <span>Colour Badge</span>
            <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', marginLeft: '2px' }}>*</span>
          </h2>

          <BadgeSelector
            selectedBadgeId={badgeRing}
            onSelect={(id) => setBadgeRing(id)}
            photoUrl={photoDraft.previewUrl}
            crop={photoDraft.crop}
          />
        </div>

        {/* E. Warna & Pola Bulu (Opsional - Collapsible) */}
        <div className="form-group" id="collapsible-appearance-group">
          <div className={`collapsible-appearance-card ${isAppearanceExpanded ? 'open' : ''}`}>
            <button
              type="button"
              className="collapsible-appearance-trigger"
              onClick={() => setIsAppearanceExpanded((prev) => !prev)}
              aria-expanded={isAppearanceExpanded}
              id="btn-toggle-appearance"
            >
              <div className="collapsible-appearance-left">
                <span className="collapsible-appearance-title">
                  <Palette size={16} style={{ color: 'var(--color-primary)' }} />
                  <span>Warna & Pola Bulu (Opsional)</span>
                </span>
                {!isAppearanceExpanded && (selectedCoatColors.length > 0 || selectedPatterns.length > 0) && (
                  <span className="collapsible-appearance-summary">
                    {[
                      selectedCoatColors.map((c) => formatAppearanceLabel(c)).join(', '),
                      selectedPatterns.map((p) => formatAppearanceLabel(p)).join(', '),
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                )}
              </div>
              <div className="collapsible-appearance-chevron">
                <ChevronDown size={18} />
              </div>
            </button>

            {isAppearanceExpanded && (
              <div className="collapsible-appearance-body" id="collapsible-appearance-content">
                {/* Subsection: Warna Bulu */}
                <div>
                  <label className="form-label" style={{ marginBottom: '8px' }}>
                    Warna Bulu
                  </label>
                  <div className="chip-group">
                    {PRESET_COAT_COLORS.map((c) => {
                      const isSelected = selectedCoatColors.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`chip-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleCoatColor(c.id)}
                        >
                          <span>{c.label}</span>
                        </button>
                      );
                    })}

                    {/* Custom Coat Color Chips */}
                    {customCoatColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="chip-btn selected"
                        onClick={() => toggleCoatColor(c)}
                      >
                        <span>{c}</span>
                        <span
                          className="chip-remove-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomCoat(c);
                          }}
                          title="Hapus pilihan"
                        >
                          <X size={12} />
                        </span>
                      </button>
                    ))}

                    {!showAddCoat ? (
                      <button
                        type="button"
                        className="chip-btn"
                        style={{ borderStyle: 'dashed' }}
                        onClick={() => setShowAddCoat(true)}
                      >
                        <Plus size={13} />
                        <span>Tambah</span>
                      </button>
                    ) : (
                      <form onSubmit={handleAddCustomCoat} className="chip-add-form">
                        <input
                          type="text"
                          className="chip-add-input"
                          placeholder="Warna baru..."
                          value={newCoatInput}
                          onChange={(e) => setNewCoatInput(e.target.value)}
                          autoFocus
                        />
                        <button type="submit" className="chip-add-submit">
                          OK
                        </button>
                        <button
                          type="button"
                          className="chip-remove-x"
                          onClick={() => {
                            setShowAddCoat(false);
                            setNewCoatInput('');
                          }}
                        >
                          <X size={14} />
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Subsection: Pola Bulu */}
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <label className="form-label" style={{ marginBottom: '8px' }}>
                    Pola Bulu
                  </label>
                  <div className="chip-group">
                    {PRESET_PATTERNS.map((p) => {
                      const isSelected = selectedPatterns.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`chip-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => togglePattern(p.id)}
                        >
                          <span>{p.label}</span>
                        </button>
                      );
                    })}

                    {/* Custom Pattern Chips */}
                    {customPatterns.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="chip-btn selected"
                        onClick={() => togglePattern(p)}
                      >
                        <span>{p}</span>
                        <span
                          className="chip-remove-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomPattern(p);
                          }}
                          title="Hapus pola"
                        >
                          <X size={12} />
                        </span>
                      </button>
                    ))}

                    {!showAddPattern ? (
                      <button
                        type="button"
                        className="chip-btn"
                        style={{ borderStyle: 'dashed' }}
                        onClick={() => setShowAddPattern(true)}
                      >
                        <Plus size={13} />
                        <span>Tambah</span>
                      </button>
                    ) : (
                      <form onSubmit={handleAddCustomPattern} className="chip-add-form">
                        <input
                          type="text"
                          className="chip-add-input"
                          placeholder="Pola baru..."
                          value={newPatternInput}
                          onChange={(e) => setNewPatternInput(e.target.value)}
                          autoFocus
                        />
                        <button type="submit" className="chip-add-submit">
                          OK
                        </button>
                        <button
                          type="button"
                          className="chip-remove-x"
                          onClick={() => {
                            setShowAddPattern(false);
                            setNewPatternInput('');
                          }}
                        >
                          <X size={14} />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* F. Bagian Catatan */}
        <div className="form-group">
          <label htmlFor="cat-notes-input" className="form-label">
            Catatan
          </label>
          <textarea
            id="cat-notes-input"
            className="form-textarea"
            rows={3}
            placeholder="Ciri khas, sifat, atau kebiasaan kucing ini"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Tombol Simpan */}
        <button
          type="submit"
          className="btn-primary"
          disabled={
            isSubmitting ||
            !name.trim() ||
            !badgeRing ||
            latitude === null ||
            longitude === null
          }
          id="btn-save-cat"
          style={{ marginTop: 'var(--space-2)' }}
        >
          <Save size={18} />
          <span>{isSubmitting ? 'Menyimpan Kucing...' : 'Simpan Kucing'}</span>
        </button>
      </form>

      {/* Map Location Picker Modal */}
      {showMapPicker && (
        <MapLocationPickerModal
          initialLat={latitude}
          initialLng={longitude}
          onConfirm={({ latitude: lat, longitude: lng, address: resolvedAddr }) => {
            setLatitude(lat);
            setLongitude(lng);
            setLocationSource('manual');
            if (resolvedAddr) {
              setLocationName(resolvedAddr);
            } else {
              handleLocationResolved(lat, lng);
            }
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};
