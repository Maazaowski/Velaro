import { useEffect } from 'react';
import { Package, Container, FileText, Play, Square, Loader, RefreshCw } from 'lucide-react';
import { usePublishStore } from '../stores/publishStore';
import type { DeployMode, ExportFormat } from '../stores/publishStore';
import { usePlaygroundStore } from '../stores/playgroundStore';
import Topbar from '../components/Topbar';
import './publish/Publish.css';
import './Dashboard.css';

const deployCards: { mode: DeployMode; icon: string; title: string; desc: string }[] = [
  { mode: 'api', icon: '⚙️', title: 'Local API Server', desc: 'Serve via OpenAI-compatible REST API on localhost' },
  { mode: 'export', icon: '📦', title: 'Export Model', desc: 'Export as SafeTensors, ONNX, or quantized weights' },
  { mode: 'docker', icon: '🐳', title: 'Docker Container', desc: 'Package as a portable Docker image with inference server' },
];

const exportFormats: { format: ExportFormat; name: string; desc: string }[] = [
  { format: 'safetensors', name: 'SafeTensors', desc: 'Safe, fast, universal' },
  { format: 'onnx', name: 'ONNX', desc: 'Cross-platform runtime' },
  { format: 'int8', name: 'INT8', desc: 'Dynamic quantization' },
  { format: 'fp16', name: 'FP16', desc: 'Half precision' },
];

export default function Publish() {
  const {
    selectedModel, deployMode, setDeployMode,
    serverStatus, serverHost, serverPort, setServerHost, setServerPort,
    exportFormat, exportLogs, exportFiles, isExporting,
    dockerfile, dockerCompose, dockerGenerated,
    modelCard, cardGenerated,
    setSelectedModel, setExportFormat,
    fetchServerStatus, startServer, stopServer,
    runExport, fetchExportFiles, generateDocker, generateModelCard,
  } = usePublishStore();

  const { availableModels, fetchModels } = usePlaygroundStore();

  useEffect(() => {
    fetchModels();
    fetchServerStatus();
  }, []);

  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0].name);
    }
  }, [availableModels]);

  useEffect(() => {
    if (selectedModel) fetchExportFiles();
  }, [selectedModel]);

  return (
    <>
      <Topbar title="Publish" subtitle="Deploy your model as API, export, or Docker container" />
      <div className="page-content">

        {/* Model selector */}
        <div className="card fade-in" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>Select Model</h3></div>
          <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {availableModels.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No models ready. Train a model first.</span>
            ) : (
              availableModels.map((m) => (
                <button
                  key={m.name}
                  className={`btn ${selectedModel === m.name ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedModel(m.name)}
                >
                  {m.name}
                  {m.train_loss != null && <span style={{ opacity: 0.7, fontSize: 11 }}> · {m.train_loss.toFixed(2)}</span>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Deploy mode selector */}
        <div className="deploy-cards fade-in">
          {deployCards.map((card) => (
            <div
              key={card.mode}
              className={`deploy-card ${deployMode === card.mode ? 'selected' : ''}`}
              onClick={() => setDeployMode(card.mode)}
            >
              <div className="deploy-card-icon">{card.icon}</div>
              <div className="deploy-card-title">{card.title}</div>
              <div className="deploy-card-desc">{card.desc}</div>
            </div>
          ))}
        </div>

        {/* ── API Server ── */}
        {deployMode === 'api' && (
          <div className="fade-in">
            <div className="publish-grid">
              <div className="card">
                <div className="card-header"><h3>Server Configuration</h3></div>
                <div className="card-body">
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Host</label>
                    <input type="text" value={serverHost} onChange={(e) => setServerHost(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Port</label>
                    <input type="number" value={serverPort} onChange={(e) => setServerPort(Number(e.target.value))} />
                  </div>

                  <div className="server-status-row">
                    <div className={`server-dot ${serverStatus.running ? 'running' : 'stopped'}`} />
                    <span style={{ fontWeight: 500 }}>{serverStatus.running ? 'Running' : 'Stopped'}</span>
                    {serverStatus.running && serverStatus.pid && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>PID {serverStatus.pid}</span>
                    )}
                    <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '5px 10px', fontSize: 12 }} onClick={fetchServerStatus}>
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    {!serverStatus.running ? (
                      <button className="btn btn-success" onClick={startServer} disabled={!selectedModel}>
                        <Play size={14} /> Start Server
                      </button>
                    ) : (
                      <button className="btn btn-danger" onClick={stopServer}>
                        <Square size={14} /> Stop Server
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h3>Endpoints</h3></div>
                <div className="card-body">
                  <div className="endpoint-box">
                    GET  http://{serverHost}:{serverPort}/v1/models{'\n'}
                    POST http://{serverHost}:{serverPort}/v1/chat/completions{'\n'}
                    POST http://{serverHost}:{serverPort}/v1/completions
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Example usage:</div>
                  <div className="code-block">{`curl http://${serverHost}:${serverPort}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel || 'your-model'}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Export ── */}
        {deployMode === 'export' && (
          <div className="fade-in">
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><h3>Export Format</h3></div>
              <div className="card-body">
                <div className="format-grid">
                  {exportFormats.map((f) => (
                    <div
                      key={f.format}
                      className={`format-card ${exportFormat === f.format ? 'selected' : ''}`}
                      onClick={() => setExportFormat(f.format)}
                    >
                      <div className="format-card-name">{f.name}</div>
                      <div className="format-card-desc">{f.desc}</div>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={runExport}
                  disabled={isExporting || !selectedModel}
                >
                  {isExporting ? <><Loader size={14} className="spin" /> Exporting...</> : <><Package size={14} /> Export {exportFormat.toUpperCase()}</>}
                </button>

                {exportLogs.length > 0 && (
                  <div className="export-log" style={{ marginTop: 14 }}>
                    {exportLogs.map((l, i) => <div key={i} className="export-log-line">{l}</div>)}
                  </div>
                )}
              </div>
            </div>

            {exportFiles.length > 0 && (
              <div className="card fade-in">
                <div className="card-header">
                  <h3>Exported Files</h3>
                  <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12 }} onClick={fetchExportFiles}>
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>
                <div className="card-body">
                  <div className="export-files">
                    {exportFiles.map((file) => (
                      <div key={file.path} className="export-file-row">
                        <span className="export-file-icon">{fileIcon(file.type)}</span>
                        <span className="export-file-name">{file.name}</span>
                        <span className="export-file-type">{file.type}</span>
                        <span className="export-file-size">{file.size_mb} MB</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Docker ── */}
        {deployMode === 'docker' && (
          <div className="fade-in">
            <div className="publish-grid">
              <div className="card">
                <div className="card-header"><h3>Generate Docker Files</h3></div>
                <div className="card-body">
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                    Generates a <code>Dockerfile</code> and <code>docker-compose.yml</code> to package your model
                    with a built-in inference server. The container exposes an OpenAI-compatible API.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={generateDocker}
                    disabled={!selectedModel}
                  >
                    <Container size={14} /> Generate Docker Files
                  </button>
                  {dockerGenerated && (
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--success)' }}>
                      ✓ Saved to <code>exports/{selectedModel}/</code>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h3>Model Card</h3></div>
                <div className="card-body">
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                    Auto-generate a markdown model card with architecture details, training stats, and usage examples.
                  </p>
                  <button
                    className="btn btn-outline"
                    onClick={generateModelCard}
                    disabled={!selectedModel}
                  >
                    <FileText size={14} /> Generate Model Card
                  </button>
                </div>
              </div>
            </div>

            {dockerGenerated && dockerfile && (
              <div className="card fade-in" style={{ marginBottom: 16 }}>
                <div className="card-header"><h3>Dockerfile</h3></div>
                <div className="card-body" style={{ padding: '12px 16px' }}>
                  <div className="code-block">{dockerfile}</div>
                </div>
              </div>
            )}

            {dockerGenerated && dockerCompose && (
              <div className="card fade-in" style={{ marginBottom: 16 }}>
                <div className="card-header"><h3>docker-compose.yml</h3></div>
                <div className="card-body" style={{ padding: '12px 16px' }}>
                  <div className="code-block">{dockerCompose}</div>
                </div>
              </div>
            )}

            {cardGenerated && modelCard && (
              <div className="card fade-in">
                <div className="card-header"><h3>Model Card Preview</h3></div>
                <div className="card-body" style={{ padding: '12px 16px' }}>
                  <div className="model-card-preview">{modelCard}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function fileIcon(type: string): string {
  return { SafeTensors: '🔷', PyTorch: '🔶', ONNX: '🟩', 'Model Card': '📄', 'Docker Compose': '🐳', Dockerfile: '🐳' }[type] ?? '📁';
}
