import { useEffect, useRef } from 'react';
import './TrainingMonitor.css';

interface LogOutputProps {
  lines: string[];
}

export default function LogOutput({ lines }: LogOutputProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines]);

  const colorize = (line: string) => {
    if (line.includes('METRIC')) return 'log-metric';
    if (line.includes('WARN')) return 'log-warn';
    if (line.includes('ERROR') || line.includes('failed')) return 'log-error';
    return 'log-info';
  };

  return (
    <div className="log-output" ref={ref}>
      {lines.length === 0 ? (
        <span className="log-info">Waiting for training to start...</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className={`log-line ${colorize(line)}`}>{line}</div>
        ))
      )}
    </div>
  );
}
