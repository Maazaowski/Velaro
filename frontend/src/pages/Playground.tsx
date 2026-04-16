import { useEffect, useState } from 'react';
import { usePlaygroundStore } from '../stores/playgroundStore';
import Topbar from '../components/Topbar';
import ChatWindow from './playground/ChatWindow';
import GenerationSettings from './playground/GenerationSettings';
import BenchmarkPanel from './playground/BenchmarkPanel';
import './playground/Playground.css';
import './Dashboard.css';

export default function Playground() {
  const { fetchModels, availableModels, selectedModel, selectModel } = usePlaygroundStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'benchmark'>('chat');

  useEffect(() => {
    fetchModels();
  }, []);

  return (
    <>
      <Topbar title="Test Playground" subtitle="Chat with and evaluate your trained models" />
      <div className="page-content" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Tabs */}
        <div className="playground-tabs fade-in">
          <div
            className={`playground-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 Chat
          </div>
          <div
            className={`playground-tab ${activeTab === 'benchmark' ? 'active' : ''}`}
            onClick={() => setActiveTab('benchmark')}
          >
            📊 Benchmark
          </div>
        </div>

        <div className="playground-layout fade-in" style={{ flex: 1, minHeight: 0 }}>
          {/* Left sidebar */}
          <div className="playground-left">
            {/* Model selector */}
            <div className="model-selector-card">
              <div className="model-selector-header">Select Model</div>
              {availableModels.length === 0 ? (
                <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No models ready yet.<br />Train a model first.
                </div>
              ) : (
                availableModels.map((model) => (
                  <div
                    key={model.name}
                    className={`model-option ${selectedModel === model.name ? 'selected' : ''}`}
                    onClick={() => selectModel(model.name)}
                  >
                    <div
                      className="model-option-dot"
                      style={{ background: model.status === 'ready' ? 'var(--success)' : 'var(--text-muted)' }}
                    />
                    <div>
                      <div className="model-option-name">{model.name}</div>
                      <div className="model-option-meta">
                        {model.train_loss != null ? `Loss: ${model.train_loss.toFixed(2)}` : ''}
                        {model.step != null ? ` · ${model.step.toLocaleString()} steps` : ''}
                      </div>
                    </div>
                    {model.loaded && (
                      <span style={{ fontSize: 10, color: 'var(--success)', marginLeft: 'auto' }}>●</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Generation settings */}
            <GenerationSettings />
          </div>

          {/* Right content */}
          <div className="playground-right">
            {activeTab === 'chat' ? (
              <ChatWindow />
            ) : (
              <div style={{ overflow: 'auto', flex: 1 }}>
                <BenchmarkPanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
