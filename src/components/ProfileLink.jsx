import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import CadetAvatar from './CadetAvatar';

export default function ProfileLink({ user, avatarUrl }) {
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Cadet';
  return <Link className="account-profile" to="/profile" aria-label="Open cadet profile" title="Cadet Profile">
    <span className="avatar"><CadetAvatar user={user} src={avatarUrl} /></span>
    <span className="account-profile-text"><strong>{name}</strong></span>
    <ChevronRight className="account-profile-arrow" size={16} aria-hidden="true" />
  </Link>;
}
