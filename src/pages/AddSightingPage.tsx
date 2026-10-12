import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { catRepository } from '../db';
import { catService } from '../services/catService';
import { compressImage, validateImageFile } from '../utils/image';
import { getCurrentDeviceLocation, type GeoLocationError } from '../utils/geo';
import { MapLocationPickerModal } from '../components/MapLocationPickerModal';
import type { Cat, FoodType } from '../types';

export const AddSightingPage: React.FC = () => {
  const { catId } = useParams<{ catId: string }>();
  const navigate = useNavigate();

  const [cat, setCat] = useState<Cat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Photo State
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ width?: number; height?: number; mimeType: string }>({
    mimeType: 'image/jpeg',
  });
  const [setAsCoverPhoto, setSetAsCoverPhoto] = useState(false);

  // Sighting & Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [spottedAt, setSpottedAt] = useState(() => {
    const now = new Date();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!catId) return;

    catRepository.getById(catId)
      .then((c) => {
        if (!c) {
          setFormError('Cat not found.');
        } else {
          setCat(c);
        }
      })
      .catch(() => {
        setFormError('Failed to load cat profile.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [catId]);

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
    e.target.value = '';

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid file format.');
      return;
    }

    try {
      setFormError(null);
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
      setFormError('Failed to process image file.');
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
      setGeoError(geoErr.message || 'Unable to retrieve location.');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catId) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const spotDate = new Date(spottedAt);
      const isoSpottedAt = isNaN(spotDate.getTime()) ? new Date().toISOString() : spotDate.toISOString();

      await catService.addSightingToExistingCat({
        catId,
        photoBlob: selectedBlob,
        photoMimeType: photoMeta.mimeType,
        photoWidth: photoMeta.width,
        photoHeight: photoMeta.height,
        latitude,
        longitude,
        locationName: locationName.trim() || undefined,
        notes: notes.trim() || undefined,
        spottedAt: isoSpottedAt,
        fedCat,
        foodType: fedCat ? foodType : undefined,
        feedingNotes: fedCat && feedingNotes.trim() ? feedingNotes.trim() : undefined,
        setAsCoverPhoto,
      });

      navigate(`/cats/${catId}`, {
        state: { flashMessage: `New sighting recorded for ${cat?.name || 'cat'}!` },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save sighting.';
      setFormError(msg);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page-container" id="add-sighting-page">
      <div className="page-header-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/cats/${catId}`)}
          style={{ padding: '6px 12px' }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h1 className="page-title" style={{ fontSize: 'var(--font-size-lg)' }}>
          Add Sighting {cat ? `for ${cat.name}` : ''}
        </h1>
        <div style={{ width: 60 }} />
      </div>

      {formError && (
        <div className="info-banner" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
          <span style={{ color: 'var(--color-danger)' }}>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card" id="add-sighting-form">
        {/* Photo Selection */}
        <div className="form-group">
          <label className="form-label">
            Encounter Photo <span className="form-label-optional">(optional)</span>
          </label>

          {previewUrl ? (
            <div className="photo-preview-wrap">
              <img src={previewUrl} alt="Sighting preview" className="photo-preview-img" />
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
                id="btn-sighting-camera"
              >
                <Camera size={18} />
                <span>Camera</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
                onClick={() => galleryInputRef.current?.click()}
                id="btn-sighting-gallery"
              >
                <ImageIcon size={18} />
                <span>Gallery</span>
              </button>
            </div>
          )}

          {previewUrl && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-xs)', marginTop: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={setAsCoverPhoto}
                onChange={(e) => setSetAsCoverPhoto(e.target.checked)}
              />
              <span>Set this photo as new cover for {cat?.name || 'cat'}</span>
            </label>
          )}

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

        {/* Location Section */}
        <div className="form-group">
          <label className="form-label">
            Location <span className="form-label-optional">(optional)</span>
          </label>

          <div className="geo-panel">
            <div className="geo-row" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                onClick={handleRequestLocation}
                disabled={geoLoading}
              >
                <Navigation size={14} className={geoLoading ? 'animate-spin' : ''} />
                <span>{geoLoading ? 'Acquiring GPS...' : 'GPS Location'}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                onClick={() => setShowMapPicker(true)}
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
              placeholder="Location name (e.g. Near campus library)"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>
        </div>

        {/* Encounter Date & Time */}
        <div className="form-group">
          <label htmlFor="sighting-spotted-at" className="form-label">
            Encounter Date &amp; Time
          </label>
          <input
            type="datetime-local"
            id="sighting-spotted-at"
            className="form-input"
            value={spottedAt}
            onChange={(e) => setSpottedAt(e.target.value)}
          />
        </div>

        {/* Feeding status */}
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
                placeholder="Feeding notes (e.g. dry treats)"
                value={feedingNotes}
                onChange={(e) => setFeedingNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Encounter Notes */}
        <div className="form-group">
          <label htmlFor="sighting-notes" className="form-label">
            Encounter Notes <span className="form-label-optional">(optional)</span>
          </label>
          <textarea
            id="sighting-notes"
            className="form-textarea"
            rows={3}
            placeholder="How did the cat behave? Any notable interactions?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          id="btn-save-sighting"
        >
          <Save size={18} />
          <span>{isSubmitting ? 'Saving Sighting...' : 'Save Sighting'}</span>
        </button>
      </form>

      {showMapPicker && (
        <MapLocationPickerModal
          initialLat={latitude}
          initialLng={longitude}
          onConfirm={({ latitude: lat, longitude: lng }) => {
            setLatitude(lat);
            setLongitude(lng);
            setGeoMessage('Manual coordinate pin placed');
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};
