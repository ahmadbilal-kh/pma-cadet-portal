import { useEffect, useState } from 'react';

export default function CadetAvatar({ user, src }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Cadet';
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'C';
  return <span className="cadet-avatar">{src && !failed
    ? <img src={src} alt={`${name}'s profile photo`} onError={() => setFailed(true)} />
    : <span aria-hidden="true">{initials}</span>}</span>;
}
