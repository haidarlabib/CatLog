import React, { useState, useEffect } from 'react';
import { Footprints, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  catCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ catCount = 0 }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-logo-icon" aria-hidden="true">
          <Footprints size={18} />
        </div>
        <div>
          <span className="brand-title">ProwlLog</span>
        </div>
        <span className="brand-badge">PWA</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="header-status-pill" title={`Unique cats logged: ${catCount}`}>
          <span>{catCount} {catCount === 1 ? 'Cat' : 'Cats'}</span>
        </div>

        <div 
          className="header-status-pill"
          title={isOnline ? 'Online mode active' : 'Offline mode active (Local storage available)'}
        >
          <span className={`header-status-dot ${isOnline ? '' : 'offline'}`} />
          {isOnline ? (
            <Wifi size={13} aria-hidden="true" />
          ) : (
            <WifiOff size={13} aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
};
