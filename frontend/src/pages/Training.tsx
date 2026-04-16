import Topbar from '../components/Topbar';

export default function Training() {
  return (
    <>
      <Topbar title="Training Monitor" subtitle="Live training dashboard" />
      <div className="page-content">
        <div className="card fade-in">
          <div className="card-header"><h3>Coming Soon</h3></div>
          <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>&#9655;</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Training Monitor</h3>
            <p>Live loss curves, resource usage, training logs, and model metrics.</p>
          </div>
        </div>
      </div>
    </>
  );
}
