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
      showFeedback('Profile name updated locally');
    } catch {
      showFeedback('Failed to save profile name', 'danger');
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all local data? This action will permanently remove all cats, sightings, and photos.'
    );
    if (confirmed) {
      try {
        await settingsRepository.clearAllData();
        loadStorageInfo();
        showFeedback('Local database reset successfully.');
      } catch {
        showFeedback('Failed to reset local database.', 'danger');
      }
    }
  };

  const handleRequestPersistence = async () => {
    if (!navigator.storage?.persist) {
      showFeedback('Storage persistence API not supported on this browser.', 'danger');
      return;
    }
    setIsRequestingPersist(true);
    try {
      const granted = await navigator.storage.persist();
      setIsPersisted(granted);
      loadStorageInfo();
      if (granted) {
        showFeedback('Persistent storage granted! Browser will not clear data under disk pressure.');
      } else {
        showFeedback('Browser declined persistence request (common in guest or low-storage modes).', 'danger');
      }
    } catch {
      showFeedback('Failed to request persistent storage.', 'danger');
    } finally {
      setIsRequestingPersist(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const zipBlob = await backupService.exportBackup();
      backupService.triggerDownload(zipBlob);
      showFeedback('Backup exported successfully as ZIP archive.');
    } catch (err) {
      showFeedback(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'danger');
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
        showFeedback(`Invalid backup file: ${result.error}`, 'danger');
        return;
      }
      setValidationResult(result);
      setShowRestoreModal(true);
    } catch (err) {
      showFeedback(`Error reading backup: ${err instanceof Error ? err.message : String(err)}`, 'danger');
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
      showFeedback(`Restored ${res.restoredCats} cats, ${res.restoredSightings} sightings, and ${res.restoredPhotos} photos!`);
    } catch (err) {
      showFeedback(`Restore failed: ${err instanceof Error ? err.message : String(err)}`, 'danger');
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
        showFeedback('ProwlLog added to your home screen!');
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
          <h1 className="page-title">Settings</h1>
          <span className="page-subtitle">Preferences, storage &amp; portable backups</span>
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
        <div className="settings-group-header" id="heading-profile">Profile</div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <User size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Local User Label</span>
              <span className="settings-desc">Personal local-first identifier stored on this device</span>
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
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="settings-value-pill"
                onClick={() => setIsEditingName(true)}
                title="Click to rename"
              >
                {profileName} ✎
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Group 2: Map Preferences */}
      <section className="settings-group" aria-labelledby="heading-map">
        <div className="settings-group-header" id="heading-map">Map Preferences</div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <MapPin size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Default Map View</span>
              <span className="settings-desc">Centers map on current device location when permission is granted</span>
            </div>
          </div>
          <span className="settings-value-pill">GPS Auto-center</span>
        </div>
      </section>

      {/* Group 3: Data & Privacy */}
      <section className="settings-group" aria-labelledby="heading-privacy">
        <div className="settings-group-header" id="heading-privacy">Data, Storage &amp; Backup</div>
        
        {/* Local-First Storage */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <ShieldCheck size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Local-First Privacy</span>
              <span className="settings-desc">
                Photos and cat records stay strictly on this device inside IndexedDB. No server tracking.
              </span>
            </div>
          </div>
          <span className="settings-value-pill">Active</span>
        </div>

        {/* Storage Quota Usage */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Database size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Storage Usage (Estimated)</span>
              <span className="settings-desc">
                {storageEstimate ? (
                  `${formatBytes(storageEstimate.usage)} used of ~${formatBytes(storageEstimate.quota)} browser quota estimate`
                ) : (
                  'Querying browser storage quota...'
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
              <span className="settings-label">Persistent Storage</span>
              <span className="settings-desc">
                {isPersisted === true
                  ? 'Granted. Browser protects local database from automated eviction.'
                  : isPersisted === false
                  ? 'Standard. Browser might clear data under extreme storage pressure.'
                  : 'Storage persistence status not confirmed by browser.'}
              </span>
            </div>
          </div>
          <div>
            {isPersisted === true ? (
              <span className="settings-value-pill" style={{ color: 'var(--color-primary)' }}>
                Protected ✓
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
                {isRequestingPersist ? 'Requesting...' : 'Request Persistence'}
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
              <span className="settings-label">Export Full Backup (.ZIP)</span>
              <span className="settings-desc">
                Download structured archive with metadata (JSON) and all photo images as binary files.
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
            <span>{isExporting ? 'Exporting...' : 'Export Backup'}</span>
          </button>
        </div>

        {/* Restore Backup */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Upload size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Restore from Backup</span>
              <span className="settings-desc">
                Import and recover data from a previously exported ProwlLog ZIP archive.
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
            <span>{isValidating ? 'Validating...' : 'Restore Backup'}</span>
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
                Reset Local Data
              </span>
              <span className="settings-desc">
                Permanently purge all stored cats, sightings, and photos on this browser.
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
            Clear Data
          </button>
        </div>
      </section>

      {/* Group 4: App & PWA Information */}
      <section className="settings-group" aria-labelledby="heading-app">
        <div className="settings-group-header" id="heading-app">App &amp; PWA Information</div>
        
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Smartphone size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">Network Status</span>
              <span className="settings-desc">
                {isOnline ? 'Connected to internet. Map tiles can be retrieved.' : 'Offline mode. Local data & photos fully accessible.'}
              </span>
            </div>
          </div>
          <span className="settings-value-pill">
            {isOnline ? '🟢 Online' : '🟠 Offline'}
          </span>
        </div>

        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-icon-box">
              <Smartphone size={18} />
            </div>
            <div className="settings-text-col">
              <span className="settings-label">PWA Installation</span>
              <span className="settings-desc">
                {isStandalone
                  ? 'Running in standalone PWA app window.'
                  : deferredPrompt
                  ? 'Ready to install to your device home screen.'
                  : 'Add ProwlLog to Home Screen via your browser menu for full offline experience.'}
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
                Install App
              </button>
            ) : (
              <span className="settings-value-pill">
                {isStandalone ? 'Installed ✓' : 'Web App'}
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
              <span className="settings-label">Application Version</span>
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
                <h2 className="modal-title">Confirm Database Restore</h2>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowRestoreModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                A valid ProwlLog backup archive was verified. Review the contents below and select a restore strategy.
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
                <div><strong>Cats:</strong> {validationResult.manifest.counts.cats}</div>
                <div><strong>Sightings:</strong> {validationResult.manifest.counts.sightings}</div>
                <div><strong>Photos:</strong> {validationResult.manifest.counts.photos}</div>
                <div><strong>Feeding Logs:</strong> {validationResult.manifest.counts.feedingLogs}</div>
                <div style={{ gridColumn: 'span 2', color: 'var(--color-text-muted)' }}>
                  Exported: {new Date(validationResult.manifest.exportedAt).toLocaleString()}
                </div>
              </div>

              {/* Conflict warning if any */}
              {validationResult.conflictCounts && validationResult.conflictCounts.existingCats > 0 && (
                <div className="info-banner" style={{ borderColor: 'var(--color-coral)', color: 'var(--color-coral)' }}>
                  <AlertTriangle size={15} className="info-banner-icon" />
                  <span>
                    {validationResult.conflictCounts.existingCats} cat records in this backup already exist in your local database.
                  </span>
                </div>
              )}

              {/* Strategy selector */}
              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Restore Strategy:
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
                      <strong>Replace (Recommended)</strong>
                      <div style={{ color: 'var(--color-text-secondary)' }}>
                        Overwrites all current local records with the backup file data.
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
                      <strong>Merge</strong>
                      <div style={{ color: 'var(--color-text-secondary)' }}>
                        Adds new cats and updates matching records without deleting unmentioned data.
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
                Cancel
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
                    <span>Restoring...</span>
                  </>
                ) : (
                  <span>Confirm Restore</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
