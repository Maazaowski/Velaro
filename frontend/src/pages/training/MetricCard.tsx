import './TrainingMonitor.css';

interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}

export default function MetricCard({ label, value, color, sub }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-card-value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="metric-card-label">{label}</div>
      {sub && <div className="metric-card-sub">{sub}</div>}
    </div>
  );
}
