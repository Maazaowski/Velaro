import { useNavigate } from 'react-router-dom';
import { Settings, Plus } from 'lucide-react';
import './Topbar.css';

interface TopbarProps {
  title: string;
  subtitle: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const navigate = useNavigate();

  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-breadcrumb">{subtitle}</div>
      <div className="topbar-actions">
        <button className="btn btn-outline" onClick={() => navigate('/settings')}>
          <Settings size={14} /> Settings
        </button>
        <button className="btn btn-primary" onClick={() => navigate('/create')}>
          <Plus size={14} /> New Model
        </button>
      </div>
    </div>
  );
}
