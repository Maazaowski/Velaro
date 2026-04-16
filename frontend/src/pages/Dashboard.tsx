import { useNavigate } from 'react-router-dom';
import {
  Box,
  Activity,
  Globe,
  Clock,
  Plus,
  Download,
  Settings,
  Play,
} from 'lucide-react';
import Topbar from '../components/Topbar';
import './Dashboard.css';

const models = [
  {
    id: 'textgen-350m',
    name: 'TextGen-350M',
    initial: 'T',
    meta: 'Transformer \u00b7 350M params \u00b7 Epoch 4/10',
    status: 'training' as const,
    color: 'var(--warning)',
    link: '/training',
  },
  {
    id: 'codeassist-125m',
    name: 'CodeAssist-125M',
    initial: 'C',
    meta: 'Transformer \u00b7 125M params \u00b7 Loss: 1.82',
    status: 'ready' as const,
    color: 'var(--success)',
    link: '/playground',
  },
  {
    id: 'summarizer-80m',
    name: 'Summarizer-80M',
    initial: 'S',
    meta: 'Transformer \u00b7 80M params \u00b7 Loss: 2.14',
    status: 'published' as const,
    color: 'var(--accent-light)',
    link: '/publish',
  },
  {
    id: 'qa-bot-200m',
    name: 'QA-Bot-200M',
    initial: 'Q',
    meta: 'Transformer \u00b7 200M params \u00b7 Loss: 1.95',
    status: 'published' as const,
    color: 'var(--accent-light)',
    link: '/publish',
  },
  {
    id: 'dialogflow-50m',
    name: 'DialogFlow-50M',
    initial: 'D',
    meta: 'Transformer \u00b7 50M params \u00b7 Draft',
    status: 'draft' as const,
    color: 'var(--text-secondary)',
    link: '/create',
  },
];

const quickActions = [
  { icon: Plus, label: 'Create New Model', desc: 'Start from scratch or template', link: '/create', color: 'var(--accent-light)', bg: 'var(--accent-glow)' },
  { icon: Download, label: 'Import Model', desc: 'GGUF, SafeTensors, PyTorch', link: '/', color: 'var(--success)', bg: 'rgba(0,206,201,0.1)' },
  { icon: Settings, label: 'Fine-tune Existing', desc: 'Adapt a published model', link: '/', color: 'var(--warning)', bg: 'rgba(253,203,110,0.1)' },
  { icon: Play, label: 'Test Playground', desc: 'Chat with any ready model', link: '/playground', color: 'var(--accent-light)', bg: 'rgba(108,92,231,0.1)' },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <>
      <Topbar title="Dashboard" subtitle="Overview of all models and system status" />
      <div className="page-content">
        <div className="stats-grid fade-in">
          <StatCard icon={<Box size={18} />} label="Total Models" value="7" change="+2 this week" up />
          <StatCard icon={<Activity size={18} />} label="Training Active" value="1" valueColor="var(--warning)" change="GPT-style 350M" />
          <StatCard icon={<Globe size={18} />} label="Published" value="3" valueColor="var(--success)" change="2 API, 1 local" />
          <StatCard icon={<Clock size={18} />} label="Total Training Hours" value="142h" change="+18h this week" up />
        </div>

        <div className="grid-2 fade-in">
          <div className="card">
            <div className="card-header">
              <h3>Your Models</h3>
              <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => navigate('/create')}>
                <Plus size={12} /> Create New
              </button>
            </div>
            <div className="card-body">
              {models.map((model) => (
                <div key={model.id} className="model-list-item" onClick={() => navigate(model.link)}>
                  <div className="model-avatar" style={{ background: `${model.color}22`, color: model.color }}>
                    {model.initial}
                  </div>
                  <div className="model-info">
                    <div className="model-name">{model.name}</div>
                    <div className="model-meta">{model.meta}</div>
                  </div>
                  <span className={`status-badge status-${model.status}`}>
                    {model.status.charAt(0).toUpperCase() + model.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="card-body">
              {quickActions.map((action) => (
                <div key={action.label} className="model-list-item" onClick={() => navigate(action.link)}>
                  <div className="model-avatar" style={{ background: action.bg, color: action.color }}>
                    <action.icon size={18} />
                  </div>
                  <div className="model-info">
                    <div className="model-name">{action.label}</div>
                    <div className="model-meta">{action.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  change,
  up,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  up?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className={`stat-card-change ${up ? 'up' : ''}`}>{change}</div>
    </div>
  );
}
