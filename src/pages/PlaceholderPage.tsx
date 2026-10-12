import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  milestoneTarget: string;
  description: string;
}

export const PlaceholderPage: React.FC<PlaceholderProps> = ({
  title,
  milestoneTarget,
  description,
}) => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  return (
    <div className="page-container" style={{ padding: 'var(--space-6) var(--space-4)' }}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => navigate(-1)}
        style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: '6px' }}
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      <div className="empty-state-card" style={{ margin: 'var(--space-6) auto', maxWidth: '420px' }}>
        <div className="empty-state-icon-circle">
          <Sparkles size={26} />
        </div>
        <h2 className="empty-state-title">{title}</h2>
        <span className="brand-badge" style={{ marginBottom: 'var(--space-2)' }}>
          {milestoneTarget}
        </span>
        <p className="empty-state-desc">{description}</p>
        
        <div 
          style={{ 
            marginTop: 'var(--space-2)',
            padding: '8px 12px', 
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-surface-subtle)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            width: '100%',
            textAlign: 'left'
          }}
        >
          <div><strong>Route:</strong> <code>{location.pathname}</code></div>
          {Object.keys(params).length > 0 && (
            <div><strong>Params:</strong> <code>{JSON.stringify(params)}</code></div>
          )}
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: 'var(--space-4)' }}
          onClick={() => navigate('/')}
        >
          Return to Map
        </button>
      </div>
    </div>
  );
};
