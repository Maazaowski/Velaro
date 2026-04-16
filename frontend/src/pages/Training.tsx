import { useState, useEffect } from 'react';
import { useTrainingStore, formatDuration, formatLR } from '../stores/trainingStore';
import Topbar from '../components/Topbar';
import MetricCard from './training/MetricCard';
import LossChart from './training/LossChart';
import ResourceChart from './training/ResourceChart';
import LogOutput from './training/LogOutput';
import './training/TrainingMonitor.css';
import './Dashboard.css';

const BACKEND = 'http://localhost:8000';

export default function Training() {
  const { metrics, lossHistory, resourceHistory, connect, disconnect } = useTrainingStore();
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const activeModel = metrics.model_name || 'TextGen-350M';

  // Auto-connect to the active model's WebSocket
  useEffect(() => {
    if (activeModel) {
      connect(activeModel);
    }
    return () => disconnect();
  }, [activeModel]);

  const handlePause = async () => {
    await fetch(`${BACKEND}/api/training/${activeModel}/pause`, { method: 'POST' });
  };

  const handleResume = async () => {
    await fetch(`${BACKEND}/api/training/${activeModel}/resume`, { method: 'POST' });
  };

  const handleStop = async () => {
    setShowStopConfirm(false);
    await fetch(`${BACKEND}/api/training/${activeModel}/stop`, { method: 'POST' });
  };

  const statusColor: Record<string, string> = {
    running: 'var(--warning)',
    paused: 'var(--text-secondary)',
    completed: 'var(--success)',
    failed: 'var(--danger)',
    stopping: 'var(--danger)',
    idle: 'var(--text-muted)',
    stopped: 'var(--text-muted)',
  };

  const statusLabel: Record<string, string> = {
    running: 'Training in Progress',
    paused: 'Paused',
    completed: 'Training Complete',
    failed: 'Training Failed',
    stopping: 'Stopping...',
    idle: 'Idle — Waiting to Start',
    stopped: 'Stopped',
  };

  return (
    <>
      <Topbar
        title="Training Monitor"
        subtitle={`${activeModel} — Live dashboard`}
      />
      <div className="page-content">

        {/* ── Header ── */}
        <div className="training-header fade-in">
          <div className="training-status">
            <div className={`pulse-dot ${metrics.status}`} />
            <span style={{ color: statusColor[metrics.status] ?? 'var(--text-secondary)' }}>
              {statusLabel[metrics.status] ?? metrics.status}
            </span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {metrics.elapsed_seconds > 0
              ? `Running for ${formatDuration(metrics.elapsed_seconds)}`
              : 'Not started yet'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {metrics.status === 'running' && (
              <button className="btn btn-outline" onClick={handlePause}>⏸ Pause</button>
            )}
            {metrics.status === 'paused' && (
              <button className="btn btn-outline" onClick={handleResume}>▶ Resume</button>
            )}
            {(metrics.status === 'running' || metrics.status === 'paused') && (
              <button className="btn btn-danger" onClick={() => setShowStopConfirm(true)}>■ Stop</button>
            )}
          </div>
        </div>

        {/* ── Progress ── */}
        <div className="progress-section fade-in">
          <div className="progress-info">
            <span>
              Epoch <strong>{metrics.epoch}</strong> of <strong>{metrics.total_epochs}</strong>
              {metrics.total_steps > 0 && (
                <> &middot; Step <strong>{metrics.step.toLocaleString()}</strong> of <strong>{metrics.total_steps.toLocaleString()}</strong></>
              )}
            </span>
            <strong>{metrics.progress_pct}%</strong>
          </div>
          <div className="progress-bar-outer">
            <div className="progress-bar-inner" style={{ width: `${metrics.progress_pct}%` }} />
          </div>
          <div className="progress-sub">
            <span>
              {metrics.eta_seconds > 0
                ? `ETA: ~${formatDuration(metrics.eta_seconds)} remaining`
                : 'ETA: calculating...'}
            </span>
            <span>
              {metrics.tokens_per_second > 0
                ? `${metrics.tokens_per_second.toLocaleString()} tokens/sec`
                : ''}
            </span>
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <div className="metrics-grid fade-in">
          <MetricCard
            label="Train Loss"
            value={metrics.train_loss > 0 ? metrics.train_loss.toFixed(4) : '—'}
            color="var(--accent-light)"
          />
          <MetricCard
            label="Val Loss"
            value={metrics.val_loss != null ? metrics.val_loss.toFixed(4) : '—'}
            color="var(--success)"
            sub={metrics.best_val_loss != null ? `Best: ${metrics.best_val_loss.toFixed(4)}` : undefined}
          />
          <MetricCard
            label="Learning Rate"
            value={metrics.learning_rate > 0 ? formatLR(metrics.learning_rate) : '—'}
            color="var(--warning)"
          />
          <MetricCard
            label="Grad Norm"
            value={metrics.grad_norm > 0 ? metrics.grad_norm.toFixed(3) : '—'}
          />
          <MetricCard
            label="GPU Temp"
            value={metrics.gpu_temp != null ? `${metrics.gpu_temp}°C` : 'N/A'}
            color={metrics.gpu_temp != null && metrics.gpu_temp > 80 ? 'var(--danger)' : undefined}
            sub={metrics.gpu_utilization != null ? `${metrics.gpu_utilization}% util` : undefined}
          />
        </div>

        {/* ── Charts ── */}
        <div className="charts-row fade-in">
          <div className="card">
            <div className="card-header">
              <h3>Loss Curve</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lossHistory.length > 0 ? `${lossHistory.length} points` : 'Live'}
              </span>
            </div>
            <div className="card-body" style={{ padding: '16px 16px 8px' }}>
              <LossChart data={lossHistory} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Resource Usage</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live</span>
            </div>
            <div className="card-body" style={{ padding: '16px 16px 8px' }}>
              <ResourceChart data={resourceHistory} />
            </div>
          </div>
        </div>

        {/* ── Log + Config ── */}
        <div className="bottom-row fade-in">
          <div className="card">
            <div className="card-header">
              <h3>Training Log</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {metrics.log_lines.length} lines
              </span>
            </div>
            <div className="card-body" style={{ padding: '12px 16px' }}>
              <LogOutput lines={metrics.log_lines} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><h3>Model Parameters</h3></div>
              <div className="card-body">
                <ConfigRow label="Architecture" value="Transformer (Decoder-only)" />
                <ConfigRow label="Hidden Size" value={String(metrics.model_name ? '—' : '768')} />
                <ConfigRow label="Layers" value="—" />
                <ConfigRow label="Attention Heads" value="—" />
                <ConfigRow label="Context Length" value="—" />
                <ConfigRow label="Vocabulary Size" value="—" />
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>System</h3></div>
              <div className="card-body">
                <ConfigRow
                  label="CPU"
                  value={`${metrics.cpu_percent.toFixed(0)}%`}
                />
                <ConfigRow
                  label="RAM"
                  value={`${metrics.ram_percent.toFixed(0)}%`}
                />
                <ConfigRow
                  label="GPU Util"
                  value={metrics.gpu_utilization != null ? `${metrics.gpu_utilization}%` : 'N/A'}
                />
                <ConfigRow
                  label="VRAM Used"
                  value={metrics.vram_used_gb != null ? `${metrics.vram_used_gb} GB` : 'N/A'}
                />
                <ConfigRow
                  label="GPU Temp"
                  value={metrics.gpu_temp != null ? `${metrics.gpu_temp}°C` : 'N/A'}
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Stop Confirmation ── */}
      {showStopConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>Stop Training?</h3>
            <p>
              Training will stop and the current checkpoint will be saved.
              You can resume from the checkpoint later.
            </p>
            <div className="confirm-dialog-buttons">
              <button className="btn btn-outline" onClick={() => setShowStopConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleStop}>
                Yes, Stop Training
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="config-row">
      <span className="config-label">{label}</span>
      <span className="config-value">{value}</span>
    </div>
  );
}
