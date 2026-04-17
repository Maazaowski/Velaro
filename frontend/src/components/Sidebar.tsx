import { useEffect, useState } from 'react';
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

const BACKEND = 'http://localhost:8000';

interface SystemStats {
  cpu_percent: number;
  ram_percent: number;
  gpu_available: boolean;
  gpu_utilization: number | null;
  gpu_memory_used_gb: number | null;
  gpu_memory_total_gb: number | null;
}

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

  const [stats, setStats] = useState<SystemStats>({
    cpu_percent: 0,
    ram_percent: 0,
    gpu_available: false,
    gpu_utilization: null,
    gpu_memory_used_gb: null,
    gpu_memory_total_gb: null,
  });

  useEffect(() => {
    let active = true;

    const fetchStats = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/system/stats`);
        if (!res.ok) return;
        const data: SystemStats = await res.json();
        if (active) setStats(data);
      } catch {
        // backend offline — keep last values
      }
    };

    fetchStats();
    const id = setInterval(fetchStats, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Derive GPU VRAM % from used/total
  const vramPct =
    stats.gpu_available && stats.gpu_memory_total_gb && stats.gpu_memory_used_gb
      ? Math.round((stats.gpu_memory_used_gb / stats.gpu_memory_total_gb) * 100)
      : null;

  const gpuPct =
    stats.gpu_available && stats.gpu_utilization != null
      ? Math.round(stats.gpu_utilization)
      : null;

  const barColor = (v: number) =>
    v >= 90 ? 'var(--danger)' : v >= 70 ? 'var(--warning)' : 'var(--success)';

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
          <StatBar
            label="CPU"
            value={Math.round(stats.cpu_percent)}
            color={barColor(stats.cpu_percent)}
          />
          <StatBar
            label="RAM"
            value={Math.round(stats.ram_percent)}
            color={barColor(stats.ram_percent)}
          />
          {gpuPct !== null && (
            <StatBar
              label="GPU"
              value={gpuPct}
              color={barColor(gpuPct)}
            />
          )}
          {vramPct !== null && (
            <StatBar
              label="VRAM"
              value={vramPct}
              color={barColor(vramPct)}
            />
          )}
          {!stats.gpu_available && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              No GPU detected
            </div>
          )}
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
