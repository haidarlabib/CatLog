import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
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
  RefreshCw
} from 'lucide-react';
import { settingsRepository } from '../db';
import { backupService, type BackupValidationResult } from '../services/backupService';

export const SettingsPage: React.FC = () => {
  const [profileName, setProfileName] = useState('Cat Explorer');
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

    // Check PWA display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Load persisted profile name from settingsRepository
    settingsRepository.get<string>('profileName', 'Cat Explorer')
      .then((saved) => {
        if (saved) setProfileName(saved);
      })
      .catch(() => {});

    // Query storage estimate & persistence
    loadStorageInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleSaveProfileName = async () => {
    try {
      await settingsRepository.set('profileName', profileName);
      setIsEditingName(false);
      showFeedback('Nama profil berhasil diperbarui');
    } catch {
      showFeedback('Gagal menyimpan nama profil', 'danger');
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
    e.target.value = ''; // Reset so the same file can be re-selected

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

      {/* Hidden file input for backup ZIP */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".zip,application/zip"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
        id="backup-file-input"
      />

      {/* Group 1: Profile */}
      <section className="settings-group" aria-labelledby="heading-profile">
        <div className="settings-group-header" id="heading-profile">Profil</div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <User size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Label Pengguna Lokal</span>
              <span className="settings-desc">Nama pengguna yang tersimpan lokal di perangkat ini</span>
            </div>
          </div>
          <div>
            {isEditingName ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)'
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                  onClick={handleSaveProfileName}
                >
                  Simpan
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="settings-value-pill"
                onClick={() => setIsEditingName(true)}
                title="Klik untuk mengubah"
              >
                {profileName}
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
              <span className="settings-label">Penggunaan Penyimpanan (Perkiraan)</span>
              <span className="settings-desc">
                {storageEstimate ? (
                  `${formatBytes(storageEstimate.usage)} terpakai dari ~${formatBytes(storageEstimate.quota)} perkiraan kuota browser`
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
                  ? 'Diizinkan. Browser melindungi database lokal dari pembersihan otomatis.'
                  : isPersisted === false
                  ? 'Standar. Browser mungkin membersihkan data saat ruang penyimpanan menipis.'
                  : 'Status penyimpanan persisten belum dikonfirmasi browser.'}
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
              <span className="settings-label">Ekspor Cadangan Lengkap (.ZIP)</span>
              <span className="settings-desc">
                Unduh arsip data terstruktur beserta metadata (JSON) dan file foto.
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
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor Cadangan'}</span>
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
                Impor dan pulihkan data dari arsip ZIP ProwlLog sebelumnya.
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
            <span>{isValidating ? 'Memeriksa...' : 'Pulihkan Cadangan'}</span>
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
                Hapus permanen semua data kucing, riwayat pertemuan, dan foto di browser ini.
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
        <div className="settings-group-header" id="heading-app">Informasi Aplikasi &amp; PWA</div>
        
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Smartphone size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Status Jaringan</span>
              <span className="settings-desc">
                {isOnline ? 'Terhubung ke internet. Peta dapat dimuat.' : 'Mode offline. Data lokal & foto tetap dapat diakses penuh.'}
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
                  ? 'Berjalan dalam jendela aplikasi PWA tersendiri.'
                  : deferredPrompt
                  ? 'Siap dipasang ke layar utama perangkat.'
                  : 'Tambahkan ProwlLog ke Layar Utama melalui menu browser untuk pengalaman offline maksimal.'}
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
              <span className="settings-desc">ProwlLog Progressive Web App (Milestone 5)</span>
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
                <h2 className="modal-title">Konfirmasi Pemulihan Database</h2>
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
                Arsip cadangan ProwlLog yang valid berhasil diverifikasi. Periksa ringkasan di bawah dan pilih metode pemulihan.
              </p>

              {/* Archive Summary Card */}
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

              {/* Conflict warning if any */}
              {validationResult.conflictCounts && validationResult.conflictCounts.existingCats > 0 && (
                <div className="info-banner" style={{ borderColor: 'var(--color-coral)', color: 'var(--color-coral)' }}>
                  <AlertTriangle size={15} className="info-banner-icon" />
                  <span>
                    {validationResult.conflictCounts.existingCats} catatan kucing dalam cadangan ini sudah ada di database lokal Anda.
                  </span>
                </div>
              )}

              {/* Strategy selector */}
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
                        Menimpa seluruh data lokal saat ini dengan data dari file cadangan.
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
                        Menambahkan kucing baru dan memperbarui data yang cocok tanpa menghapus data lainnya.
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
