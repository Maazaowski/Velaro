import { usePlaygroundStore } from '../../stores/playgroundStore';
import { FlaskConical, Loader } from 'lucide-react';
import './Playground.css';

export default function BenchmarkPanel() {
  const { benchmarkResults, isBenchmarking, runBenchmark, selectedModel } = usePlaygroundStore();

  return (
    <div className="benchmark-panel">
      <div className="benchmark-header">
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Benchmark</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Run 5 standard prompts and measure performance
          </div>
        </div>
        <button
          className="btn btn-outline"
          onClick={runBenchmark}
          disabled={isBenchmarking || !selectedModel}
          style={{ fontSize: 12, padding: '7px 14px' }}
        >
          {isBenchmarking
            ? <><Loader size={13} className="spin" /> Running...</>
            : <><FlaskConical size={13} /> Run Benchmark</>
          }
        </button>
      </div>

      {benchmarkResults.length === 0 && !isBenchmarking && (
        <div className="benchmark-empty">
          Click "Run Benchmark" to evaluate your model on standard prompts.
        </div>
      )}

      {benchmarkResults.map((r, i) => (
        <div key={i} className="benchmark-result">
          <div className="benchmark-prompt">
            <span className="benchmark-prompt-label">Prompt</span>
            <span>{r.prompt}</span>
          </div>
          <div className="benchmark-response">{r.response || '...'}</div>
          <div className="benchmark-metrics">
            <span>{r.metrics.totalTokens} tokens</span>
            <span>{r.metrics.tokensPerSecond} tok/s</span>
            <span>{r.metrics.latencyMs}ms TTFT</span>
            {r.metrics.perplexity != null && <span>PPL: {r.metrics.perplexity}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
