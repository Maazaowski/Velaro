import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Activity,
  FlaskConical,
  Upload,
  Settings,
} from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { section: 'Main' },
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/create', icon: Plus, label: 'Create Model' },
  { section: 'Active' },
  { path: '/training', icon: Activity, label: 'Training Monitor', badge: 1 },
  { section: 'Tools' },
  { path: '/playground', icon: FlaskConical, label: 'Test Playground' },
  { path: '/publish', icon: Upload, label: 'Publish' },
  { section: 'System' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="sidebar">
      <div className="logo">
        <div className="logo-icon">V</div>
        <div className="logo-text">Velaro</div>
        <span className="logo-version">v0.1</span>
      </div>

      <nav className="nav">
        {navItems.map((item, i) => {
          if ('section' in item && !('path' in item)) {
            return (
              <div key={i} className="nav-section">
                {item.section}
              </div>
            );
          }
          if ('path' in item) {
            const Icon = item.icon!;
            const isActive = location.pathname === item.path;
            return (
              <div
                key={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path!)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {'badge' in item && item.badge && (
                  <span className="badge">{item.badge}</span>
                )}
              </div>
            );
          }
          return null;
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="system-stats">
          <div className="system-stats-title">System Resources</div>
          <StatBar label="CPU" value={34} color="var(--success)" />
          <StatBar label="RAM" value={67} color="var(--warning)" />
          <StatBar label="GPU" value={82} color="var(--accent-light)" />
          <StatBar label="VRAM" value={91} color="var(--danger)" />
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-bar">
      <div className="stat-bar-header">
        <span>{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
