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
import type { ResourcePoint } from '../../stores/trainingStore';

interface ResourceChartProps {
  data: ResourcePoint[];
}

export default function ResourceChart({ data }: ResourceChartProps) {
  if (data.length === 0) {
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
        Resource data will appear here once training starts
      </div>
    );
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
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ background: '#222535', border: '1px solid #2d3148', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#8a8da0' }}
          formatter={(val) => (typeof val === 'number' ? `${val.toFixed(1)}%` : String(val))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="gpu" name="GPU %" stroke="#ff7675" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
        <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#00cec9" dot={false} strokeWidth={1.5} strokeDasharray="4 2" isAnimationActive={false} />
        <Line type="monotone" dataKey="ram" name="RAM %" stroke="#fdcb6e" dot={false} strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
