import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SensorModalChartPoint {
  timestamp: string;
  value: number;
}

interface SensorModalChartProps {
  points: SensorModalChartPoint[];
}

export function SensorModalChart({ points }: SensorModalChartProps) {
  const chartData = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        timeLabel: format(new Date(point.timestamp), 'HH:mm'),
      })),
    [points],
  );

  if (chartData.length === 0) {
    return (
      <div className="h-64 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
        No sensor data available for this range.
      </div>
    );
  }

  return (
    <div className="h-64 min-h-[256px] min-w-0 rounded-xl border border-gray-100 bg-white">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
        <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe5ef" />
          <XAxis
            dataKey="timeLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#64748b' }}
            minTickGap={24}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#64748b' }}
            domain={['auto', 'auto']}
            width={44}
          />
          <Tooltip
            formatter={(value: number) => value.toFixed(2)}
            labelFormatter={(_, payload) => {
              const point = payload && payload[0] && payload[0].payload;
              if (!point) {
                return '';
              }

              return format(new Date(point.timestamp), 'MMM dd, HH:mm:ss');
            }}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#4FA3C7"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}