import { useEffect, useState } from 'react';
import './SplashScreen.css';

interface Props {
  onReady: () => void;
}

type Phase = 'starting' | 'connecting' | 'ready' | 'timeout';

const BACKEND = 'http://localhost:8000';
const MAX_ATTEMPTS = 30;       // 30 × 500 ms = 15 s timeout
const POLL_INTERVAL_MS = 500;

export default function SplashScreen({ onReady }: Props) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [attempt, setAttempt] = useState(0);
  const [dots, setDots] = useState('');

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);

  // Poll backend health
  useEffect(() => {
    let active = true;
    let count = 0;

    // Short initial pause so the window renders first
    const delay = setTimeout(() => {
      setPhase('connecting');

      const poll = async () => {
        if (!active) return;
        count++;
        setAttempt(count);

        try {
          const res = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(400) });
          if (res.ok && active) {
            setPhase('ready');
            setTimeout(onReady, 600); // brief "ready" flash
            return;
          }
        } catch {
          // backend not up yet — keep polling
        }

        if (count >= MAX_ATTEMPTS) {
          if (active) setPhase('timeout');
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      };

      poll();
    }, 800);

    return () => {
      active = false;
      clearTimeout(delay);
    };
  }, [onReady]);

  const progress = Math.min((attempt / MAX_ATTEMPTS) * 100, 100);

  const phaseLabel: Record<Phase, string> = {
    starting: 'Initializing',
    connecting: 'Starting backend',
    ready: 'Ready',
    timeout: 'Taking longer than expected',
  };

  return (
    <div className={`splash-root ${phase === 'ready' ? 'splash-fade-out' : ''}`}>
      <div className="splash-content">
        {/* Logo */}
        <div className="splash-logo">
          <div className="splash-logo-icon">V</div>
          <div className="splash-logo-text">Velaro</div>
        </div>

        <div className="splash-tagline">Your local LLM builder</div>

        {/* Spinner */}
        {phase !== 'ready' && phase !== 'timeout' && (
          <div className="splash-spinner" />
        )}

        {phase === 'ready' && (
          <div className="splash-check">✓</div>
        )}

        {/* Status */}
        <div className="splash-status">
          {phase === 'timeout' ? (
            <>
              <span className="splash-status-warn">Backend is slow to start</span>
              <button
                className="splash-retry-btn"
                onClick={() => {
                  setPhase('connecting');
                  setAttempt(0);
                }}
              >
                Retry
              </button>
              <button
                className="splash-skip-btn"
                onClick={onReady}
              >
                Continue anyway
              </button>
            </>
          ) : (
            <span>
              {phaseLabel[phase]}{phase !== 'ready' ? dots : ''}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {(phase === 'connecting' || phase === 'starting') && (
          <div className="splash-progress-track">
            <div
              className="splash-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="splash-version">v0.1.0</div>
      </div>
    </div>
  );
}
