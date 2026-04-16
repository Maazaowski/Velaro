import { useState, useRef, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { usePlaygroundStore } from '../../stores/playgroundStore';
import type { Message, ResponseMetrics } from '../../stores/playgroundStore';
import './Playground.css';

export default function ChatWindow() {
  const { messages, isGenerating, selectedModel, sendMessage, clearChat } = usePlaygroundStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-topbar">
        <div className="pulse-indicator" style={{
          width: 8, height: 8, borderRadius: '50%',
          background: selectedModel ? 'var(--success)' : 'var(--text-muted)',
        }} />
        <span className="chat-model-name">{selectedModel || 'No model selected'}</span>
        <span className="chat-session-info">
          {messages.filter(m => m.role === 'user').length} messages
        </span>
        {messages.length > 0 && (
          <button
            className="btn btn-outline"
            style={{ padding: '5px 10px', fontSize: 12 }}
            onClick={clearChat}
          >
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <h3>Start a conversation</h3>
            <p>Type a message to test your model's output.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              isStreaming={isGenerating && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder={selectedModel ? 'Type a message… (Enter to send, Shift+Enter for newline)' : 'Select a model first'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!selectedModel || isGenerating}
          rows={1}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!selectedModel || isGenerating || !input.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ message, isStreaming }: { message: Message; isStreaming: boolean }) {
  return (
    <div className={`bubble-wrapper ${message.role}`}>
      <div className={`bubble ${message.role} ${isStreaming && !message.content ? 'streaming' : ''}`}>
        {message.content || (isStreaming ? '' : '...')}
      </div>
      {message.metrics && <BubbleMetrics metrics={message.metrics} />}
      {!message.metrics && (
        <div className="bubble-meta">
          <span>{message.role === 'user' ? 'You' : 'Model'} &middot; {formatTime(message.timestamp)}</span>
        </div>
      )}
    </div>
  );
}

function BubbleMetrics({ metrics }: { metrics: ResponseMetrics }) {
  return (
    <div className="bubble-meta">
      <span>⚡ {metrics.tokensPerSecond} tok/s</span>
      <span>🔢 {metrics.totalTokens} tokens</span>
      <span>⏱ {metrics.latencyMs}ms TTFT</span>
      {metrics.perplexity != null && <span>📊 PPL: {metrics.perplexity}</span>}
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
