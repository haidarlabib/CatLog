import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, 
  Image as ImageIcon, 
  Trash2, 
  MapPin, 
  Navigation, 
  ArrowLeft, 
  Save, 
  AlertCircle 
} from 'lucide-react';
import { catService } from '../services/catService';
import { compressImage, validateImageFile } from '../utils/image';
import { getCurrentDeviceLocation, type GeoLocationError } from '../utils/geo';
import { MapLocationPickerModal } from '../components/MapLocationPickerModal';
import type { FoodType } from '../types';

const BREED_OPTIONS = [
  'Not sure yet',
  'Domestic',
  'Persian',
  'Angora',
  'Maine Coon',
  'Siamese',
  'Bengal',
  'Other',
];

export const AddCatPage: React.FC = () => {
  const navigate = useNavigate();

  // Photo State
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ width?: number; height?: number; mimeType: string }>({
    mimeType: 'image/jpeg',
  });

  // Profile Form State
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('Not sure yet');
  const [coatColor, setCoatColor] = useState('');
  const [pattern, setPattern] = useState('');
  const [profileNotes, setProfileNotes] = useState('');

  // Sighting & Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState('');
  const [sightingNotes, setSightingNotes] = useState('');
  const [spottedAt, setSpottedAt] = useState(() => {
    const now = new Date();
    // Format YYYY-MM-DDTHH:mm for datetime-local input
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Feeding State
  const [fedCat, setFedCat] = useState(false);
  const [foodType, setFoodType] = useState<FoodType>('wet_food');
  const [feedingNotes, setFeedingNotes] = useState('');

  // Status & Error States
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Hidden File Inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Clean up Blob URLs on unmount or photo change
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be picked again if desired
    e.target.value = '';

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid file format.');
      return;
    }

    try {
      setFormError(null);
      // Client-side compression
      const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });

      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      const newPreview = URL.createObjectURL(compressed.blob);
      setSelectedBlob(compressed.blob);
      setPreviewUrl(newPreview);
      setPhotoMeta({
        width: compressed.width,
        height: compressed.height,
        mimeType: compressed.mimeType,
      });
    } catch {
      setFormError('Failed to process image file. Please try another photo.');
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedBlob(null);
    setPreviewUrl(null);
  };

  const handleRequestLocation = async () => {
    setGeoLoading(true);
    setGeoError(null);
    setGeoMessage(null);

    try {
      const pos = await getCurrentDeviceLocation();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      setGeoMessage(`GPS captured (accuracy: ±${pos.accuracy}m)`);
    } catch (err: unknown) {
      const geoErr = err as GeoLocationError;
      setGeoError(geoErr.message || 'Unable to retrieve device location.');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setFormError('Cat name is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const colors = coatColor
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const patterns = pattern
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Convert local datetime to full ISO 8601
      const spotDate = new Date(spottedAt);
      const isoSpottedAt = isNaN(spotDate.getTime()) ? new Date().toISOString() : spotDate.toISOString();

      const result = await catService.createCatWithFirstSighting({
        name: cleanName,
        breed: breed !== 'Not sure yet' ? breed : 'unknown',
        coatColors: colors,
        patterns,
        notes: profileNotes.trim() || undefined,
        photoBlob: selectedBlob,
        photoMimeType: photoMeta.mimeType,
        photoWidth: photoMeta.width,
        photoHeight: photoMeta.height,
        latitude,
        longitude,
        locationName: locationName.trim() || undefined,
        sightingNotes: sightingNotes.trim() || undefined,
        spottedAt: isoSpottedAt,
        fedCat,
        foodType: fedCat ? foodType : undefined,
        feedingNotes: fedCat && feedingNotes.trim() ? feedingNotes.trim() : undefined,
      });

      // Navigate to Cat Detail page
      navigate(`/cats/${result.cat.id}`, {
        state: { flashMessage: `"${cleanName}" successfully added to your CATalog!` },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save cat profile.';
      setFormError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container" id="add-cat-page">
      <div className="page-header-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(-1)}
          aria-label="Back"
          style={{ padding: '6px 12px' }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h1 className="page-title" style={{ fontSize: 'var(--font-size-lg)' }}>Log New Cat</h1>
        <div style={{ width: 60 }} />
      </div>

      {formError && (
        <div className="info-banner" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }} role="alert">
          <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
          <span style={{ color: 'var(--color-danger)' }}>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card" id="add-cat-form">
        {/* 1. Photo Section */}
        <div className="form-group">
          <label className="form-label">
            Cat Photo <span className="form-label-optional">(recommended)</span>
          </label>

          {previewUrl ? (
            <div className="photo-preview-wrap">
              <img src={previewUrl} alt="Preview of cat" className="photo-preview-img" />
              <div className="photo-preview-overlay">
                <button
                  type="button"
                  className="photo-preview-btn"
                  onClick={() => galleryInputRef.current?.click()}
                  aria-label="Change photo"
                >
                  <ImageIcon size={14} />
                  <span>Change</span>
                </button>
                <button
                  type="button"
                  className="photo-preview-btn"
                  style={{ backgroundColor: 'rgba(217, 72, 65, 0.85)' }}
                  onClick={handleRemovePhoto}
                  aria-label="Remove photo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="photo-picker-row">
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
                onClick={() => cameraInputRef.current?.click()}
                id="btn-take-photo"
              >
                <Camera size={18} />
                <span>Take Photo</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
                onClick={() => galleryInputRef.current?.click()}
                id="btn-choose-gallery"
              >
                <ImageIcon size={18} />
                <span>Gallery</span>
              </button>
            </div>
          )}

          {/* Hidden Inputs */}
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          <input
            type="file"
            ref={galleryInputRef}
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>

        {/* 2. Cat Profile Basics */}
        <div className="form-group">
          <label htmlFor="cat-name-input" className="form-label">
            Cat Name <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            id="cat-name-input"
            className="form-input"
            placeholder="e.g. Oyen, Mochi, Oreo..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="cat-breed-select" className="form-label">
            Breed / Type <span className="form-label-optional">(optional)</span>
          </label>
          <select
            id="cat-breed-select"
            className="form-select"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          >
            {BREED_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="cat-color-input" className="form-label">
            Coat Color &amp; Pattern <span className="form-label-optional">(optional)</span>
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              id="cat-color-input"
              className="form-input"
              placeholder="Colors: Orange, White"
              value={coatColor}
              onChange={(e) => setCoatColor(e.target.value)}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Pattern: Tabby, Calico"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
          </div>
        </div>

        {/* 3. Encounter & Location Section */}
        <div className="form-group">
          <label className="form-label">
            Sighting Location <span className="form-label-optional">(optional)</span>
          </label>

          <div className="geo-panel">
            <div className="geo-row" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                onClick={handleRequestLocation}
                disabled={geoLoading}
                id="btn-get-gps"
              >
                <Navigation size={14} className={geoLoading ? 'animate-spin' : ''} />
                <span>{geoLoading ? 'Acquiring GPS...' : 'GPS Location'}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                onClick={() => setShowMapPicker(true)}
                id="btn-pick-on-map"
              >
                <MapPin size={14} />
                <span>Pick on Map</span>
              </button>

              {latitude !== null && longitude !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="geo-badge">
                    <MapPin size={12} />
                    <span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
                  </span>
                  <button
                    type="button"
                    style={{ fontSize: '11px', color: 'var(--color-danger)', padding: '2px 6px' }}
                    onClick={() => {
                      setLatitude(null);
                      setLongitude(null);
                      setGeoMessage(null);
                    }}
                    title="Remove coordinates"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {geoMessage && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 500 }}>
                {geoMessage}
              </span>
            )}
            {geoError && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
                {geoError}
              </span>
            )}

            <input
              type="text"
              className="form-input"
              placeholder="Location name (e.g. Garden Park, Coffee Shop)"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              id="cat-location-name"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="sighting-time-input" className="form-label">
            Encounter Date &amp; Time
          </label>
          <input
            type="datetime-local"
            id="sighting-time-input"
            className="form-input"
            value={spottedAt}
            onChange={(e) => setSpottedAt(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="sighting-notes-input" className="form-label">
            Encounter Notes <span className="form-label-optional">(optional)</span>
          </label>
          <input
            type="text"
            id="sighting-notes-input"
            className="form-input"
            placeholder="What was the cat doing? (e.g. resting in garden)"
            value={sightingNotes}
            onChange={(e) => setSightingNotes(e.target.value)}
          />
        </div>

        {/* 4. Feeding Log Section */}
        <div className="form-group">
          <label className="form-label">Did you feed this cat?</label>
          <div className="feeding-toggle-row">
            <button
              type="button"
              className={`feeding-choice-btn ${!fedCat ? 'selected' : ''}`}
              onClick={() => setFedCat(false)}
            >
              No
            </button>
            <button
              type="button"
              className={`feeding-choice-btn ${fedCat ? 'selected' : ''}`}
              onClick={() => setFedCat(true)}
            >
              Yes
            </button>
          </div>

          {fedCat && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <select
                className="form-select"
                value={foodType}
                onChange={(e) => setFoodType(e.target.value as FoodType)}
              >
                <option value="wet_food">Wet food (can/pouch)</option>
                <option value="dry_food">Dry food (kibble)</option>
                <option value="treat">Cat treat</option>
                <option value="other">Other food</option>
              </select>
              <input
                type="text"
                className="form-input"
                placeholder="Feeding details (e.g. Tuna pate, half can)"
                value={feedingNotes}
                onChange={(e) => setFeedingNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* 5. Personal Notes */}
        <div className="form-group">
          <label htmlFor="cat-notes-input" className="form-label">
            Notes <span className="form-label-optional">(optional)</span>
          </label>
          <textarea
            id="cat-notes-input"
            className="form-textarea"
            rows={3}
            placeholder="Temperament, collar color, habits..."
            value={profileNotes}
            onChange={(e) => setProfileNotes(e.target.value)}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          id="btn-save-cat"
          style={{ marginTop: 'var(--space-2)' }}
        >
          <Save size={18} />
          <span>{isSubmitting ? 'Saving to Database...' : 'Save Cat to CATalog'}</span>
        </button>
      </form>

      {showMapPicker && (
        <MapLocationPickerModal
          initialLat={latitude}
          initialLng={longitude}
          onConfirm={({ latitude: lat, longitude: lng }) => {
            setLatitude(lat);
            setLongitude(lng);
            setGeoMessage(`Manual coordinate pin placed`);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};
