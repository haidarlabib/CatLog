import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export const PwaUpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered() {
      // SW registered safely
    },
    onRegisterError(error) {
      console.warn('SW registration warning:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-banner" role="alert" id="pwa-update-prompt">
      <div className="pwa-update-content">
        <Sparkles size={16} className="pwa-update-icon" />
        <span className="pwa-update-message">
          A new version of ProwlLog is ready. Update whenever you have saved your work.
        </span>
      </div>
      <div className="pwa-update-actions">
        <button
          type="button"
          className="btn-primary"
          style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', width: 'auto' }}
          onClick={() => updateServiceWorker(true)}
          id="btn-pwa-update-now"
        >
          <RefreshCw size={13} />
          <span>Update Now</span>
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)' }}
          onClick={() => setNeedRefresh(false)}
          aria-label="Dismiss update notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
