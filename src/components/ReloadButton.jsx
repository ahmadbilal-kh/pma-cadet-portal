import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ReloadButton() {
  const { refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await refreshUser();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch { setError('Unable to refresh. Please try again.'); }
    finally { setBusy(false); }
  }
  return <><button type="button" className="reload-btn" onClick={refresh} disabled={busy} aria-busy={busy} title="Refresh account details">
    <RotateCw size={16} aria-hidden="true" />{busy ? 'Refreshing…' : 'Refresh'}
  </button>{error && <span role="alert">{error}</span>}</>;
}
