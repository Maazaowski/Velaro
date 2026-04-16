import Topbar from '../components/Topbar';

export default function Playground() {
  return (
    <>
      <Topbar title="Test Playground" subtitle="Chat with your trained models" />
      <div className="page-content">
        <div className="card fade-in">
          <div className="card-header"><h3>Coming Soon</h3></div>
          <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>&#9881;</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Test Playground</h3>
            <p>Interactive chat interface to test and evaluate your models.</p>
          </div>
        </div>
      </div>
    </>
  );
}
