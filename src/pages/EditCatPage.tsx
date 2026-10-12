import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Camera, 
  Save, 
  AlertCircle 
} from 'lucide-react';
import { catRepository } from '../db';
import { catService } from '../services/catService';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { compressImage, validateImageFile } from '../utils/image';
import type { Cat } from '../types';

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

export const EditCatPage: React.FC = () => {
  const { catId } = useParams<{ catId: string }>();
  const navigate = useNavigate();

  const [cat, setCat] = useState<Cat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Field State
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('Not sure yet');
  const [coatColor, setCoatColor] = useState('');
  const [pattern, setPattern] = useState('');
  const [notes, setNotes] = useState('');

  // New Photo Upload State
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ width?: number; height?: number; mimeType: string }>({
    mimeType: 'image/jpeg',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!catId) return;

    catRepository.getById(catId)
      .then((c) => {
        if (!c) {
          setErrorMsg('Cat profile not found.');
          setIsLoading(false);
          return;
        }
        setCat(c);
        setName(c.name);
        setBreed(c.breed && c.breed !== 'unknown' ? c.breed : 'Not sure yet');
        setCoatColor(c.coatColors ? c.coatColors.join(', ') : '');
        setPattern(c.patterns ? c.patterns.join(', ') : '');
        setNotes(c.notes || '');
      })
      .catch(() => {
        setErrorMsg('Failed to load profile for editing.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [catId]);

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (newPreviewUrl && newPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(newPreviewUrl);
      }
    };
  }, [newPreviewUrl]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const val = validateImageFile(file);
    if (!val.valid) {
      setErrorMsg(val.error || 'Invalid file format.');
      return;
    }

    try {
      setErrorMsg(null);
      const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });

      if (newPreviewUrl && newPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(newPreviewUrl);
      }

      const url = URL.createObjectURL(compressed.blob);
      setSelectedBlob(compressed.blob);
      setNewPreviewUrl(url);
      setPhotoMeta({
        width: compressed.width,
        height: compressed.height,
        mimeType: compressed.mimeType,
      });
    } catch {
      setErrorMsg('Failed to process image file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catId) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Cat name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const colors = coatColor
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const patterns = pattern
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await catService.updateCatProfile(catId, {
        name: cleanName,
        breed: breed !== 'Not sure yet' ? breed : 'unknown',
        coatColors: colors,
        patterns,
        notes: notes.trim() || undefined,
        newPhotoBlob: selectedBlob,
        newPhotoMimeType: photoMeta.mimeType,
        newPhotoWidth: photoMeta.width,
        newPhotoHeight: photoMeta.height,
      });

      navigate(`/cats/${catId}`, {
        state: { flashMessage: 'Cat profile updated successfully!' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update cat profile.';
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <p>Loading edit form...</p>
      </div>
    );
  }

  return (
    <div className="page-container" id="edit-cat-page">
      <div className="page-header-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/cats/${catId}`)}
          style={{ padding: '6px 12px' }}
        >
          <ArrowLeft size={16} />
          <span>Cancel</span>
        </button>
        <h1 className="page-title" style={{ fontSize: 'var(--font-size-lg)' }}>Edit Profile</h1>
        <div style={{ width: 60 }} />
      </div>

      {errorMsg && (
        <div className="info-banner" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
          <span style={{ color: 'var(--color-danger)' }}>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card" id="edit-cat-form">
        {/* Cover Photo */}
        <div className="form-group">
          <label className="form-label">Cover Photo</label>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <div style={{ width: 100, height: 100, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', flexShrink: 0 }}>
              {newPreviewUrl ? (
                <img src={newPreviewUrl} alt="New cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <CatPhotoImg photoId={cat?.coverPhotoId} alt="Current cover photo" />
              )}
            </div>
            <div>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '8px 12px' }}
                onClick={() => fileInputRef.current?.click()}
                id="btn-change-cover-photo"
              >
                <Camera size={14} />
                <span>Upload New Photo</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="form-group">
          <label htmlFor="edit-cat-name" className="form-label">
            Cat Name <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            id="edit-cat-name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Breed */}
        <div className="form-group">
          <label htmlFor="edit-cat-breed" className="form-label">
            Breed / Type
          </label>
          <select
            id="edit-cat-breed"
            className="form-select"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          >
            {BREED_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Coat Colors & Pattern */}
        <div className="form-group">
          <label htmlFor="edit-cat-color" className="form-label">
            Coat Color &amp; Pattern
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              id="edit-cat-color"
              className="form-input"
              placeholder="e.g. Orange, White"
              value={coatColor}
              onChange={(e) => setCoatColor(e.target.value)}
            />
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Tabby, Bicolor"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label htmlFor="edit-cat-notes" className="form-label">
            Profile Notes
          </label>
          <textarea
            id="edit-cat-notes"
            className="form-textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          id="btn-save-edit"
        >
          <Save size={18} />
          <span>{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
        </button>
      </form>
    </div>
  );
};
