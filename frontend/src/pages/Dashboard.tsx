import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Activity,
  Globe,
  Clock,
  Plus,
  Download,
  Play,
  Trash2,
  Copy,
  Pencil,
  MoreHorizontal,
  X,
  Check,
} from 'lucide-react';
import Topbar from '../components/Topbar';
import { useModelStore } from '../stores/modelStore';
import type { VelaroModel } from '../stores/modelStore';
import './Dashboard.css';

const quickActions = [
  {
    icon: Plus,
    label: 'Create New Model',
    desc: 'Start from scratch with the wizard',
    link: '/create',
    color: 'var(--accent-light)',
    bg: 'var(--accent-glow)',
  },
  {
    icon: Download,
    label: 'Import Model',
    desc: 'GGUF, SafeTensors, PyTorch',
    link: '/settings',
    color: 'var(--success)',
    bg: 'rgba(0,206,201,0.1)',
  },
  {
    icon: Activity,
    label: 'Fine-Tune Existing',
    desc: 'Adapt a model with LoRA',
    link: '/settings',
    color: 'var(--warning)',
    bg: 'rgba(253,203,110,0.1)',
  },
  {
    icon: Play,
    label: 'Test Playground',
    desc: 'Chat with any ready model',
    link: '/playground',
    color: 'var(--accent-light)',
    bg: 'rgba(108,92,231,0.1)',
  },
];

const MODEL_LINK: Record<string, string> = {
  draft: '/create',
  training: '/training',
  ready: '/playground',
  published: '/publish',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { models, isLoading, fetchModels, deleteModel, renameModel, cloneModel } = useModelStore();

  // Context menu state
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  // Delete confirm overlay
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // Rename inline state
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    fetchModels();
    // Close menus on outside click
    const close = () => setMenuOpen(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const trainingCount = models.filter((m) => m.status === 'training').length;
  const publishedCount = models.filter((m) => m.status === 'published').length;
  const readyCount = models.filter((m) => m.status === 'ready').length;

  const handleMenuClick = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setMenuOpen((prev) => (prev === name ? null : name));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteModel(deleteTarget);
    setDeleteTarget(null);
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    await renameModel(renameTarget, renameValue.trim());
    setRenameTarget(null);
    setRenameValue('');
  };

  const handleClone = async (name: string) => {
    const newName = `${name}-copy`;
    await cloneModel(name, newName);
    setMenuOpen(null);
  };

  const modelInitial = (name: string) => name.charAt(0).toUpperCase();
  const modelColor = (status: VelaroModel['status']) => {
    if (status === 'training') return 'var(--warning)';
    if (status === 'ready') return 'var(--success)';
    if (status === 'published') return 'var(--accent-light)';
    return 'var(--text-muted)';
  };
  const modelMeta = (m: VelaroModel) => {
    const parts: string[] = [];
    if (m.architecture) parts.push(m.architecture.charAt(0).toUpperCase() + m.architecture.slice(1));
    if (m.num_layers && m.hidden_size) {
      const params = estimateParams(m);
      if (params) parts.push(params);
    }
    if (m.train_loss) parts.push(`Loss: ${m.train_loss.toFixed(2)}`);
    if (m.base_model) parts.push(`LoRA from ${m.base_model}`);
    return parts.join(' · ') || 'No details';
  };

  return (
    <>
      <Topbar title="Dashboard" subtitle="Overview of all models and system status" />
      <div className="page-content">
        <div className="stats-grid fade-in">
          <StatCard
            icon={<Box size={18} />}
            label="Total Models"
            value={String(models.length)}
            change={isLoading ? 'Loading…' : `${models.length} in library`}
          />
          <StatCard
            icon={<Activity size={18} />}
            label="Training Active"
            value={String(trainingCount)}
            valueColor={trainingCount > 0 ? 'var(--warning)' : undefined}
            change={trainingCount > 0 ? 'Running now' : 'None running'}
          />
          <StatCard
            icon={<Globe size={18} />}
            label="Published"
            value={String(publishedCount)}
            valueColor={publishedCount > 0 ? 'var(--success)' : undefined}
            change={`${readyCount} ready, ${publishedCount} deployed`}
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Models Ready"
            value={String(readyCount)}
            change="Available for inference"
            up={readyCount > 0}
          />
        </div>

        <div className="grid-2 fade-in">
          {/* Models list */}
          <div className="card">
            <div className="card-header">
              <h3>Your Models</h3>
              <button
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => navigate('/create')}
              >
                <Plus size={12} /> Create New
              </button>
            </div>
            <div className="card-body">
              {isLoading && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Loading models…
                </div>
              )}
              {!isLoading && models.length === 0 && (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No models yet.{' '}
                  <span
                    style={{ color: 'var(--accent-light)', cursor: 'pointer' }}
                    onClick={() => navigate('/create')}
                  >
                    Create your first model →
                  </span>
                </div>
              )}
              {models.map((model) => (
                <div key={model.name} className="model-list-item" style={{ position: 'relative' }}>
                  {/* Avatar */}
                  <div
                    className="model-avatar"
                    style={{
                      background: `${modelColor(model.status)}22`,
                      color: modelColor(model.status),
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(MODEL_LINK[model.status] ?? '/')}
                  >
                    {modelInitial(model.name)}
                  </div>

                  {/* Info — rename inline or display */}
                  <div
                    className="model-info"
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => navigate(MODEL_LINK[model.status] ?? '/')}
                  >
                    {renameTarget === model.name ? (
                      <div
                        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit();
                            if (e.key === 'Escape') { setRenameTarget(null); setRenameValue(''); }
                          }}
                          style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--accent-light)',
                            borderRadius: 4, color: 'var(--text-primary)', fontSize: 13,
                            padding: '2px 6px', flex: 1,
                          }}
                        />
                        <button
                          onClick={handleRenameSubmit}
                          style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => { setRenameTarget(null); setRenameValue(''); }}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="model-name">{model.name}</div>
                    )}
                    <div className="model-meta">{modelMeta(model)}</div>
                  </div>

                  {/* Status badge */}
                  <span className={`status-badge status-${model.status}`}>
                    {model.status.charAt(0).toUpperCase() + model.status.slice(1)}
                  </span>

                  {/* Context menu button */}
                  <button
                    className="model-menu-btn"
                    onClick={(e) => handleMenuClick(e, model.name)}
                    title="More actions"
                  >
                    <MoreHorizontal size={15} />
                  </button>

                  {/* Dropdown */}
                  {menuOpen === model.name && (
                    <div className="model-dropdown" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setRenameTarget(model.name);
                          setRenameValue(model.name);
                          setMenuOpen(null);
                        }}
                      >
                        <Pencil size={13} /> Rename
                      </button>
                      <button onClick={() => handleClone(model.name)}>
                        <Copy size={13} /> Clone
                      </button>
                      <button
                        className="danger"
                        onClick={() => { setDeleteTarget(model.name); setMenuOpen(null); }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card">
            <div className="card-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="card-body">
              {quickActions.map((action) => (
                <div
                  key={action.label}
                  className="model-list-item"
                  onClick={() => navigate(action.link)}
                >
                  <div
                    className="model-avatar"
                    style={{ background: action.bg, color: action.color }}
                  >
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

      {/* Delete confirmation overlay */}
      {deleteTarget && (
        <div className="confirm-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">Delete "{deleteTarget}"?</div>
            <div className="confirm-desc">
              This will permanently remove the model directory and all checkpoints. This cannot be undone.
            </div>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleDelete}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Helpers ────────────────────────────────────────────

function estimateParams(m: VelaroModel): string | null {
  if (!m.num_layers || !m.hidden_size) return null;
  const ff = (m.hidden_size ?? 0) * 4;
  const params =
    m.num_layers * (4 * m.hidden_size * m.hidden_size + 2 * m.hidden_size * ff) +
    (m.vocab_size ?? 50257) * m.hidden_size;
  if (params >= 1e9) return `${(params / 1e9).toFixed(1)}B params`;
  if (params >= 1e6) return `${Math.round(params / 1e6)}M params`;
  return `${Math.round(params / 1e3)}K params`;
}

function StatCard({
  label,
  value,
  change,
  up,
  valueColor,
  icon,
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
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className={`stat-card-change ${up ? 'up' : ''}`}>{change}</div>
    </div>
  );
}
