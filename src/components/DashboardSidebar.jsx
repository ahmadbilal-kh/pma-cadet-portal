import { BarChart3, BookOpen, BrainCircuit, Eye, House, Mic, ShieldCheck, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import Brand from './Brand';

const trainingLinks = [
  { to: '/test/verbal', title: 'Verbal Intelligence', icon: BrainCircuit },
  { to: '/test/nonverbal', title: 'Non-Verbal Intelligence', icon: Eye },
  { to: '/test/academic', title: 'Academic Preparation', icon: BookOpen },
];

export default function DashboardSidebar() {
  const linkClass = ({ isActive }) => `side-link ${isActive ? 'active' : 'side-link-muted'}`;
  return <aside className="dashboard-sidebar">
    <div>
      <Brand inverse to="/dashboard" />
      <nav aria-label="Workspace navigation">
        <div className="sidebar-caption">YOUR WORKSPACE</div>
        <NavLink to="/dashboard" end replace className={linkClass} title="Home"><House size={19} /> Home</NavLink>
        <NavLink to="/profile" className={linkClass} title="Cadet Profile"><UserRound size={19} /> Cadet Profile</NavLink>
        <NavLink to="/progress" className={linkClass} title="History & Progress"><BarChart3 size={19} /> History & Progress</NavLink>
        <NavLink to="/issb" className={linkClass} title="ISSB Interview"><Mic size={19} /> ISSB Interview</NavLink>
        <div className="sidebar-caption" style={{ marginTop: 34 }}>TRAINING AREAS</div>
        {trainingLinks.map(({ to, title, icon: Icon }) =>
          <NavLink to={to} className={linkClass} title={title} key={to}><Icon size={19} />{title}</NavLink>
        )}
      </nav>
    </div>
    <div className="sidebar-foot"><ShieldCheck size={18} /> DISCIPLINE · FOCUS · PROGRESS <small>Independent practice platform</small></div>
  </aside>;
}
