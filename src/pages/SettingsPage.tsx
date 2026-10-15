import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Trash2, 
  CheckCircle2, 
  Download, 
  Upload, 
  Database, 
  AlertTriangle, 
  X, 
  FileCheck2, 
  RefreshCw, 
  Camera, 
  ImagePlus,
  Edit2,
  HardDrive
} from 'lucide-react';
import { settingsRepository } from '../db';
import { backupService, type BackupValidationResult } from '../services/backupService';
import { useUserProfile } from '../utils/useUserProfile';

export const SettingsPage: React.FC = () => {
  const { profile, updateNickname, updatePhoto, removePhoto } = useUserProfile();

  const [editName, setEditName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');

  // Storage Quota state
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);

  // Backup & Restore state
  const [isExporting, setIsExporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreStrategy, setRestoreStrategy] = useState<'replace' | 'merge'>('replace');
  const [isRestoring, setIsRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (msg: string, type: 'success' | 'danger' = 'success') => {
    setFeedbackMsg(msg);
    setFeedbackType(type);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const loadStorageInfo = () => {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        if (est.usage !== undefined && est.quota !== undefined) {
          setStorageEstimate({ usage: est.usage, quota: est.quota });
        }
      }).catch(() => {});
    }
  };

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const handleStartEditName = () => {
    setEditName(profile.nickname);
    setIsEditingName(true);
  };

  const handleSaveProfileName = async () => {
    try {
      await updateNickname(editName);
      setIsEditingName(false);
      showFeedback('Nama profil berhasil diperbarui');
    } catch {
      showFeedback('Gagal menyimpan nama profil', 'danger');
    }
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Resize to max 200x200 for profile avatar
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise((resolve) => { img.onload = resolve; });
      
      const SIZE = 200;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      
      // Center crop
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(url);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
      });

      await updatePhoto(blob);
      showFeedback('Foto profil berhasil diperbarui');
    } catch {
      showFeedback('Gagal memproses foto profil', 'danger');
    }
  };

  const handleRemoveProfilePhoto = async () => {
    try {
      await removePhoto();
      showFeedback('Foto profil dihapus');
    } catch {
      showFeedback('Gagal menghapus foto profil', 'danger');
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(
      'Apakah Anda yakin ingin menghapus semua data lokal? Tindakan ini akan menghapus permanen semua data kucing, riwayat pertemuan, dan foto di perangkat ini.'
    );
    if (confirmed) {
      try {
        await settingsRepository.clearAllData();
        loadStorageInfo();
        showFeedback('Database lokal berhasil diatur ulang.');
      } catch {
        showFeedback('Gagal mengatur ulang database lokal.', 'danger');
      }
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const zipBlob = await backupService.exportBackup();
      backupService.triggerDownload(zipBlob);
      showFeedback('Cadangan data berhasil diekspor sebagai arsip ZIP.');
    } catch (err) {
      showFeedback(`Ekspor gagal: ${err instanceof Error ? err.message : String(err)}`, 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  const handleTriggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsValidating(true);
    try {
      const result = await backupService.validateBackupFile(file);
      if (!result.isValid) {
        showFeedback(`File cadangan tidak valid: ${result.error}`, 'danger');
        return;
      }
      setValidationResult(result);
      setShowRestoreModal(true);
    } catch (err) {
      showFeedback(`Gagal membaca file cadangan: ${err instanceof Error ? err.message : String(err)}`, 'danger');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!validationResult || !validationResult.isValid) return;
    setIsRestoring(true);
    try {
      const res = await backupService.restoreBackup(validationResult, restoreStrategy);
      setShowRestoreModal(false);
      setValidationResult(null);
      loadStorageInfo();
      showFeedback(`Berhasil memulihkan ${res.restoredCats} kucing, ${res.restoredSightings} pertemuan, dan ${res.restoredPhotos} foto!`);
    } catch (err) {
      showFeedback(`Pemulihan gagal: ${err instanceof Error ? err.message : String(err)}`, 'danger');
    } finally {
      setIsRestoring(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Generate initials for avatar fallback
  const initials = profile.nickname
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className="page-container settings-page" id="settings-page" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 32px)' }}>
      {/* Editorial Header */}
      <div className="settings-header-wrap">
        <h1 className="settings-title">Pengaturan</h1>
        <p className="settings-subtitle">Preferensi profil &amp; manajemen cadangan data</p>
      </div>

      {/* Floating / Inline Feedback Notice */}
      {feedbackMsg && (
        <div 
          className="info-banner settings-feedback-banner" 
          role="status"
          style={{ 
            borderColor: feedbackType === 'danger' ? 'var(--color-danger)' : undefined,
            color: feedbackType === 'danger' ? 'var(--color-danger)' : undefined
          }}
        >
          {feedbackType === 'danger' ? (
            <AlertTriangle size={16} className="info-banner-icon" />
          ) : (
            <CheckCircle2 size={16} className="info-banner-icon" />
          )}
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".zip,application/zip"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
        id="backup-file-input"
      />
      <input
        type="file"
        ref={profilePhotoInputRef}
        accept="image/jpeg,image/png,image/webp"
        onChange={handleProfilePhotoChange}
        style={{ display: 'none' }}
        id="profile-photo-input"
      />

      {/* Group 1: Profil Penjelajah */}
      <section className="settings-section" aria-labelledby="heading-profile">
        <div className="settings-section-title" id="heading-profile">Profil Penjelajah</div>
        
        <div className="settings-card profile-card">
          {/* Top Avatar + Nickname Hero */}
          <div className="profile-card-top">
            <div className="profile-avatar-wrap">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt="Foto profil"
                  className="profile-avatar-img"
                />
              ) : (
                <div className="profile-avatar-initials">{initials}</div>
              )}
              <button
                type="button"
                className="profile-avatar-badge-btn"
                onClick={() => profilePhotoInputRef.current?.click()}
                aria-label="Ubah foto profil"
                id="btn-change-profile-photo"
                title="Pilih foto profil"
              >
                <Camera size={12} />
              </button>
            </div>

            <div className="profile-info-col">
              {isEditingName ? (
                <div className="profile-name-edit-form">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter') handleSaveProfileName(); 
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    className="profile-name-input"
                    maxLength={30}
                    autoFocus
                    placeholder="Nama Penjelajah"
                    id="input-profile-name"
                  />
                  <div className="profile-name-edit-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: '5px 12px', fontSize: '12px', width: 'auto' }}
                      onClick={handleSaveProfileName}
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => setIsEditingName(false)}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="profile-name-row">
                    <span className="profile-nickname">{profile.nickname}</span>
                    <button
                      type="button"
                      className="profile-edit-name-btn"
                      onClick={handleStartEditName}
                      id="btn-edit-profile-name"
                      aria-label="Ubah nama penjelajah"
                      title="Ubah nama"
                    >
                      <Edit2 size={12} />
                      <span>Ubah nama</span>
                    </button>
                  </div>
                  <span className="profile-subtext">Tampil sebagai avatar di peta</span>
                </>
              )}
            </div>
          </div>

          {/* Photo Management Action Strip */}
          <div className="profile-card-bottom">
            <div className="profile-photo-label-col">
              <span className="settings-row-label">Foto Avatar</span>
              <span className="settings-row-desc">Format JPG, PNG, atau WebP</span>
            </div>
            <div className="profile-photo-buttons">
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => profilePhotoInputRef.current?.click()}
                id="btn-upload-profile-photo"
              >
                <ImagePlus size={14} />
                <span>{profile.photoUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
              </button>
              {profile.photoUrl && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 10px', color: 'var(--color-danger)' }}
                  onClick={handleRemoveProfilePhoto}
                  id="btn-remove-profile-photo"
                  title="Hapus foto profil"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Group 2: Pengaturan Peta */}
      <section className="settings-section" aria-labelledby="heading-map">
        <div className="settings-section-title" id="heading-map">Pengaturan Peta</div>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-icon-box">
                <MapPin size={17} />
              </div>
              <div className="settings-text-col">
                <span className="settings-row-label">Tampilan Peta Default</span>
                <span className="settings-row-desc">Pusatkan peta otomatis ke lokasi GPS saat izin lokasi diberikan</span>
              </div>
            </div>
            <span className="settings-badge-pill">GPS Otomatis</span>
          </div>
        </div>
      </section>

      {/* Group 3: Data & Cadangan */}
      <section className="settings-section" aria-labelledby="heading-data">
        <div className="settings-section-title" id="heading-data">Data &amp; Cadangan</div>
        <div className="settings-card">
          {/* Storage Quota Usage */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-icon-box">
                <Database size={17} />
              </div>
              <div className="settings-text-col">
                <span className="settings-row-label">Penggunaan Penyimpanan</span>
                <span className="settings-row-desc">
                  {storageEstimate ? (
                    `${formatBytes(storageEstimate.usage)} terpakai dari ~${formatBytes(storageEstimate.quota)} kuota browser`
                  ) : (
                    'Memeriksa kuota penyimpanan lokal...'
                  )}
                </span>
              </div>
            </div>
            <span className="settings-badge-pill">
              {storageEstimate ? formatBytes(storageEstimate.usage) : 'IndexedDB'}
            </span>
          </div>

          {/* Export Backup */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-icon-box">
                <HardDrive size={17} />
              </div>
              <div className="settings-text-col">
                <span className="settings-row-label">Ekspor Cadangan (.ZIP)</span>
                <span className="settings-row-desc">
                  Unduh arsip data terstruktur beserta metadata dan file foto.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ fontSize: '12px', padding: '7px 14px', width: 'auto', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              onClick={handleExportBackup}
              disabled={isExporting}
              id="btn-export-backup"
            >
              <Download size={14} />
              <span>{isExporting ? 'Mengekspor...' : 'Ekspor (.ZIP)'}</span>
            </button>
          </div>

          {/* Restore Backup */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-icon-box">
                <Upload size={17} />
              </div>
              <div className="settings-text-col">
                <span className="settings-row-label">Pulihkan Cadangan</span>
                <span className="settings-row-desc">
                  Impor dan pulihkan data dari file ZIP cadangan ProwlLog.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              onClick={handleTriggerFileSelect}
              disabled={isValidating}
              id="btn-restore-backup"
            >
              <Upload size={14} />
              <span>{isValidating ? 'Memeriksa...' : 'Pulihkan Data'}</span>
            </button>
          </div>

          {/* Reset Local Data (Danger Zone) */}
          <div className="settings-row danger-row">
            <div className="settings-row-left">
              <div className="settings-icon-box danger">
                <Trash2 size={17} />
              </div>
              <div className="settings-text-col">
                <span className="settings-row-label" style={{ color: 'var(--color-danger)' }}>
                  Hapus Semua Data
                </span>
                <span className="settings-row-desc">
                  Hapus permanen seluruh data kucing, riwayat pertemuan, dan foto di perangkat ini.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ 
                color: 'var(--color-danger)', 
                borderColor: 'rgba(217, 72, 65, 0.35)', 
                fontSize: '12px',
                padding: '7px 14px',
                whiteSpace: 'nowrap'
              }}
              onClick={handleClearData}
              id="btn-clear-data"
            >
              Hapus Data
            </button>
          </div>
        </div>
      </section>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && validationResult && validationResult.manifest && (
        <div className="modal-backdrop" id="restore-confirm-modal" role="dialog" aria-modal="true">
          <div className="modal-dialog" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCheck2 size={20} color="var(--color-primary)" />
                <h2 className="modal-title">Konfirmasi Pemulihan</h2>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowRestoreModal(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                File cadangan ZIP ProwlLog terverifikasi. Pilih metode pemulihan data:
              </p>

              <div style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: 'var(--font-size-xs)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                <div><strong>Kucing:</strong> {validationResult.manifest.counts.cats}</div>
                <div><strong>Pertemuan:</strong> {validationResult.manifest.counts.sightings}</div>
                <div><strong>Foto:</strong> {validationResult.manifest.counts.photos}</div>
                <div><strong>Catatan Makan:</strong> {validationResult.manifest.counts.feedingLogs}</div>
                <div style={{ gridColumn: 'span 2', color: 'var(--color-text-muted)', paddingTop: '4px' }}>
                  Diekspor: {new Date(validationResult.manifest.exportedAt).toLocaleString('id-ID')}
                </div>
              </div>

              {validationResult.conflictCounts && validationResult.conflictCounts.existingCats > 0 && (
                <div className="info-banner" style={{ borderColor: 'var(--color-coral)', color: 'var(--color-coral)' }}>
                  <AlertTriangle size={15} className="info-banner-icon" />
                  <span>
                    {validationResult.conflictCounts.existingCats} data kucing sudah ada di database lokal Anda.
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                  Metode Pemulihan:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: 'var(--font-size-xs)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: restoreStrategy === 'replace' ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                    background: restoreStrategy === 'replace' ? 'rgba(35, 119, 135, 0.05)' : 'var(--color-surface)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="restore-strategy"
                      value="replace"
                      checked={restoreStrategy === 'replace'}
                      onChange={() => setRestoreStrategy('replace')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ display: 'block', color: 'var(--color-text-primary)' }}>Ganti Semua (Disarankan)</strong>
                      <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        Menimpa seluruh data lokal dengan data dari file cadangan.
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: 'var(--font-size-xs)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: restoreStrategy === 'merge' ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                    background: restoreStrategy === 'merge' ? 'rgba(35, 119, 135, 0.05)' : 'var(--color-surface)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="restore-strategy"
                      value="merge"
                      checked={restoreStrategy === 'merge'}
                      onChange={() => setRestoreStrategy('merge')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ display: 'block', color: 'var(--color-text-primary)' }}>Gabungkan (Merge)</strong>
                      <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        Menambahkan data baru tanpa menghapus data lokal yang sudah ada.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRestoreModal(false)}
                disabled={isRestoring}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                id="btn-confirm-restore"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Memulihkan...</span>
                  </>
                ) : (
                  <span>Konfirmasi Pemulihan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
