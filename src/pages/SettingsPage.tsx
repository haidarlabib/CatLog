import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  HardDrive, 
  ShieldCheck, 
  Trash2, 
  Smartphone, 
  Info,
  CheckCircle2,
  Download,
  Upload,
  Database,
  Lock,
  AlertTriangle,
  X,
  FileCheck2,
  RefreshCw,
  Camera,
  ImagePlus
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
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Storage Quota & Persistence state
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);

  // Backup & Restore state
  const [isExporting, setIsExporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreStrategy, setRestoreStrategy] = useState<'replace' | 'merge'>('replace');
  const [isRestoring, setIsRestoring] = useState(false);

  // PWA Install Prompt state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (msg: string, type: 'success' | 'danger' = 'success') => {
    setFeedbackMsg(msg);
    setFeedbackType(type);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const loadStorageInfo = () => {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          if (est.usage !== undefined && est.quota !== undefined) {
            setStorageEstimate({ usage: est.usage, quota: est.quota });
          }
        }).catch(() => {});
      }
      if (navigator.storage.persisted) {
        navigator.storage.persisted().then((persisted) => {
          setIsPersisted(persisted);
        }).catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    loadStorageInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
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
      'Apakah Anda yakin ingin mengatur ulang semua data lokal? Tindakan ini akan menghapus permanen semua data kucing, riwayat pertemuan, dan foto.'
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

  const handleRequestPersistence = async () => {
    if (!navigator.storage?.persist) {
      showFeedback('API penyimpanan persisten tidak didukung di browser ini.', 'danger');
      return;
    }
    setIsRequestingPersist(true);
    try {
      const granted = await navigator.storage.persist();
      setIsPersisted(granted);
      loadStorageInfo();
      if (granted) {
        showFeedback('Penyimpanan persisten diizinkan! Browser tidak akan menghapus data saat memori penuh.');
      } else {
        showFeedback('Browser menolak permintaan persistensi (umum terjadi pada mode tamu).', 'danger');
      }
    } catch {
      showFeedback('Gagal meminta penyimpanan persisten.', 'danger');
    } finally {
      setIsRequestingPersist(false);
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

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsStandalone(true);
        setDeferredPrompt(null);
        showFeedback('ProwlLog berhasil ditambahkan ke layar utama!');
      }
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
    <div className="page-container" id="settings-page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Pengaturan</h1>
          <span className="page-subtitle">Preferensi, penyimpanan &amp; cadangan data</span>
        </div>
      </div>

      {feedbackMsg && (
        <div 
          className="info-banner" 
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

      {/* Group 1: Profile with Avatar */}
      <section className="settings-group" aria-labelledby="heading-profile">
        <div className="settings-group-header" id="heading-profile">Profil</div>
        
        {/* Profile Avatar + Name Hero */}
        <div className="profile-hero-row">
          <div className="profile-avatar-wrapper">
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
              className="profile-avatar-edit-btn"
              onClick={() => profilePhotoInputRef.current?.click()}
              aria-label="Ubah foto profil"
              id="btn-change-profile-photo"
            >
              <Camera size={12} />
            </button>
          </div>
          <div className="profile-hero-info">
            {isEditingName ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProfileName(); }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-focus)',
                    fontSize: 'var(--font-size-sm)',
                    flex: 1,
                    minWidth: 0,
                  }}
                  maxLength={30}
                  autoFocus
                  id="input-profile-name"
                />
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', width: 'auto' }}
                  onClick={handleSaveProfileName}
                >
                  Simpan
                </button>
              </div>
            ) : (
              <>
                <span className="profile-hero-name">{profile.nickname}</span>
                <button
                  type="button"
                  className="profile-hero-edit-link"
                  onClick={handleStartEditName}
                  id="btn-edit-profile-name"
                >
                  Ubah nama
                </button>
              </>
            )}
          </div>
        </div>

        {/* Photo actions row */}
        <div className="settings-row" style={{ paddingTop: '0' }}>
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <ImagePlus size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Foto Profil</span>
              <span className="settings-desc">Tampil sebagai avatar di peta</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 'var(--font-size-xs)', padding: '5px 10px' }}
              onClick={() => profilePhotoInputRef.current?.click()}
              id="btn-upload-profile-photo"
            >
              {profile.photoUrl ? 'Ganti' : 'Unggah'}
            </button>
            {profile.photoUrl && (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '5px 10px', color: 'var(--color-danger)' }}
                onClick={handleRemoveProfilePhoto}
                id="btn-remove-profile-photo"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Group 2: Map Preferences */}
      <section className="settings-group" aria-labelledby="heading-map">
        <div className="settings-group-header" id="heading-map">Pengaturan Peta</div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <MapPin size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Tampilan Peta Default</span>
              <span className="settings-desc">Pusatkan peta ke lokasi perangkat saat izin lokasi diberikan</span>
            </div>
          </div>
          <span className="settings-value-pill">Pusatkan GPS Otomatis</span>
        </div>
      </section>

      {/* Group 3: Data & Privacy */}
      <section className="settings-group" aria-labelledby="heading-privacy">
        <div className="settings-group-header" id="heading-privacy">Data, Penyimpanan &amp; Cadangan</div>
        
        {/* Local-First Storage */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <ShieldCheck size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Privasi Lokal Mandiri</span>
              <span className="settings-desc">
                Foto dan catatan kucing tersimpan di perangkat melalui IndexedDB. Tanpa pelacakan server.
              </span>
            </div>
          </div>
          <span className="settings-value-pill">Aktif</span>
        </div>

        {/* Storage Quota Usage */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Database size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Penggunaan Penyimpanan</span>
              <span className="settings-desc">
                {storageEstimate ? (
                  `${formatBytes(storageEstimate.usage)} terpakai dari ~${formatBytes(storageEstimate.quota)} kuota`
                ) : (
                  'Memeriksa kuota penyimpanan browser...'
                )}
              </span>
            </div>
          </div>
          <span className="settings-value-pill">
            {storageEstimate ? formatBytes(storageEstimate.usage) : 'IndexedDB'}
          </span>
        </div>

        {/* Storage Persistence */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Lock size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Penyimpanan Persisten</span>
              <span className="settings-desc">
                {isPersisted === true
                  ? 'Diizinkan. Browser melindungi database dari pembersihan otomatis.'
                  : isPersisted === false
                  ? 'Standar. Browser mungkin membersihkan data saat ruang menipis.'
                  : 'Status penyimpanan belum dikonfirmasi browser.'}
              </span>
            </div>
          </div>
          <div>
            {isPersisted === true ? (
              <span className="settings-value-pill" style={{ color: 'var(--color-primary)' }}>
                Dilindungi
              </span>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '5px 10px' }}
                onClick={handleRequestPersistence}
                disabled={isRequestingPersist}
                id="btn-request-storage-persist"
              >
                {isRequestingPersist ? 'Meminta...' : 'Minta Persistensi'}
              </button>
            )}
          </div>
        </div>

        {/* Export Backup */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <HardDrive size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Ekspor Cadangan (.ZIP)</span>
              <span className="settings-desc">
                Unduh arsip data terstruktur beserta metadata dan file foto.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px', width: 'auto' }}
            onClick={handleExportBackup}
            disabled={isExporting}
            id="btn-export-backup"
          >
            <Download size={14} />
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor'}</span>
          </button>
        </div>

        {/* Restore Backup */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Upload size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Pulihkan dari Cadangan</span>
              <span className="settings-desc">
                Impor dan pulihkan data dari arsip ZIP ProwlLog.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px' }}
            onClick={handleTriggerFileSelect}
            disabled={isValidating}
            id="btn-restore-backup"
          >
            <Upload size={14} />
            <span>{isValidating ? 'Memeriksa...' : 'Pulihkan'}</span>
          </button>
        </div>

        {/* Reset Local Data */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box danger">
              <Trash2 size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label" style={{ color: 'var(--color-danger)' }}>
                Reset Data Lokal
              </span>
              <span className="settings-desc">
                Hapus permanen semua data kucing, riwayat, dan foto.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ 
              color: 'var(--color-danger)', 
              borderColor: 'var(--color-border)', 
              fontSize: 'var(--font-size-xs)',
              padding: '6px 12px' 
            }}
            onClick={handleClearData}
            id="btn-clear-data"
          >
            Hapus Data
          </button>
        </div>
      </section>

      {/* Group 4: App & PWA Information */}
      <section className="settings-group" aria-labelledby="heading-app">
        <div className="settings-group-header" id="heading-app">Informasi Aplikasi</div>
        
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Smartphone size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Status Jaringan</span>
              <span className="settings-desc">
                {isOnline ? 'Terhubung ke internet.' : 'Mode offline. Data lokal tetap dapat diakses.'}
              </span>
            </div>
          </div>
          <span className="settings-value-pill">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Smartphone size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Instalasi PWA</span>
              <span className="settings-desc">
                {isStandalone
                  ? 'Berjalan dalam jendela aplikasi PWA.'
                  : deferredPrompt
                  ? 'Siap dipasang ke layar utama.'
                  : 'Tambahkan ProwlLog ke Layar Utama melalui menu browser.'}
              </span>
            </div>
          </div>
          <div>
            {deferredPrompt && !isStandalone ? (
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px', width: 'auto' }}
                onClick={handleInstallApp}
                id="btn-install-pwa"
              >
                Pasang Aplikasi
              </button>
            ) : (
              <span className="settings-value-pill">
                {isStandalone ? 'Terpasang' : 'Aplikasi Web'}
              </span>
            )}
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Info size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Versi Aplikasi</span>
              <span className="settings-desc">ProwlLog PWA</span>
            </div>
          </div>
          <span className="settings-value-pill">v0.1.0</span>
        </div>
      </section>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && validationResult && validationResult.manifest && (
        <div className="modal-backdrop" id="restore-confirm-modal" role="dialog" aria-modal="true">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
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
                Arsip cadangan ProwlLog yang valid berhasil diverifikasi.
              </p>

              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: 'var(--font-size-xs)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                <div><strong>Kucing:</strong> {validationResult.manifest.counts.cats}</div>
                <div><strong>Pertemuan:</strong> {validationResult.manifest.counts.sightings}</div>
                <div><strong>Foto:</strong> {validationResult.manifest.counts.photos}</div>
                <div><strong>Catatan Makan:</strong> {validationResult.manifest.counts.feedingLogs}</div>
                <div style={{ gridColumn: 'span 2', color: 'var(--color-text-muted)' }}>
                  Diekspor: {new Date(validationResult.manifest.exportedAt).toLocaleString('id-ID')}
                </div>
              </div>

              {validationResult.conflictCounts && validationResult.conflictCounts.existingCats > 0 && (
                <div className="info-banner" style={{ borderColor: 'var(--color-coral)', color: 'var(--color-coral)' }}>
                  <AlertTriangle size={15} className="info-banner-icon" />
                  <span>
                    {validationResult.conflictCounts.existingCats} catatan sudah ada di database lokal.
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Metode Pemulihan:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: 'var(--font-size-xs)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: restoreStrategy === 'replace' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: restoreStrategy === 'replace' ? 'rgba(34, 111, 128, 0.05)' : 'transparent',
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
                      <strong>Ganti Semua (Disarankan)</strong>
                      <div style={{ color: 'var(--color-text-secondary)' }}>
                        Menimpa seluruh data lokal dengan data cadangan.
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: 'var(--font-size-xs)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: restoreStrategy === 'merge' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: restoreStrategy === 'merge' ? 'rgba(34, 111, 128, 0.05)' : 'transparent',
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
                      <strong>Gabungkan (Merge)</strong>
                      <div style={{ color: 'var(--color-text-secondary)' }}>
                        Menambahkan data baru tanpa menghapus data lainnya.
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
