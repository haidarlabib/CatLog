import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

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
        <img
          src="/logo.png"
          alt="Cuking logo"
          className="brand-logo-img"
          width="32"
          height="32"
        />
        <span className="brand-title">Cuking</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="header-status-pill" title={`Total kucing terdata: ${catCount}`}>
          <span>{catCount} Kucing</span>
        </div>

        <div 
          className="header-status-pill"
          title={isOnline ? 'Mode daring aktif' : 'Mode luring aktif (Penyimpanan lokal tersedia)'}
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
