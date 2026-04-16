import Topbar from '../components/Topbar';

export default function Publish() {
  return (
    <>
      <Topbar title="Publish" subtitle="Deploy your model locally" />
      <div className="page-content">
        <div className="card fade-in">
          <div className="card-header"><h3>Coming Soon</h3></div>
          <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>&#8682;</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Publish &amp; Deploy</h3>
            <p>Serve your model via local API, export as GGUF/ONNX, or package as Docker.</p>
          </div>
        </div>
      </div>
    </>
  );
}
