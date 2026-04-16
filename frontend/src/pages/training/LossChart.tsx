import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { MetricPoint } from '../../stores/trainingStore';

interface LossChartProps {
  data: MetricPoint[];
}

export default function LossChart({ data }: LossChartProps) {
  if (data.length === 0) {
    return <EmptyChart label="Loss data will appear here once training starts" />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
        <XAxis
          dataKey="step"
          stroke="#5a5d72"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
        />
        <YAxis
          stroke="#5a5d72"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => v.toFixed(2)}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{ background: '#222535', border: '1px solid #2d3148', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#8a8da0' }}
          formatter={(val) => (typeof val === 'number' ? val.toFixed(4) : String(val))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="train_loss"
          name="Train Loss"
          stroke="#a29bfe"
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="val_loss"
          name="Val Loss"
          stroke="#00cec9"
          dot={false}
          strokeWidth={2}
          strokeDasharray="5 3"
          isAnimationActive={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{
      height: 220,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
      fontSize: 13,
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-sm)',
    }}>
      {label}
    </div>
  );
}
