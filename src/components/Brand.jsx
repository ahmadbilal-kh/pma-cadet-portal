import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Brand({ inverse = false, to = '/' }) {
  return <Link className={`brand ${inverse ? 'brand-light' : ''}`} to={to} aria-label="PMA Cadet Portal home">
    <span className="brand-emblem"><ShieldCheck size={24} strokeWidth={1.8} /></span>
    <span className="brand-wordmark"><strong>CADET<span>PREP</span></strong><small>PMA PREPARATION PORTAL</small></span>
  </Link>;
}
