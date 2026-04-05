import { useEffect, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { ProcessedSensorData } from '../../types';

interface SensorChartProps {
  data: ProcessedSensorData;
  color?: string;
}

export function SensorChart({ data, color = '#4FA3C7' }: SensorChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const width = Math.floor(element.clientWidth);
      const height = Math.floor(element.clientHeight);

      setChartSize((previous) => {
        if (previous.width === width && previous.height === height) {
          return previous;
        }

        return { width, height };
      });
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const chartData = data.history.map(h => ({
    time: format(new Date(h.timestamp), 'HH:mm:ss'),
    value: h.value
  }));

  return (
    <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm h-[300px] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-semibold text-gray-900">{data.name} Trend</h3>
          <p className="text-xs text-gray-500">Real-time monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">{data.currentValue.toFixed(1)}</span>
          <span className="text-sm text-gray-500">{data.unit}</span>
        </div>
      </div>
      
      <div ref={chartContainerRef} className="flex-1 w-full min-h-[220px] min-w-0">
        {chartSize.width > 0 && chartSize.height > 0 ? (
          <AreaChart
            width={chartSize.width}
            height={chartSize.height}
            data={chartData}
            margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`color${data.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              minTickGap={30}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#0f172a', fontWeight: 600 }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2}
              fillOpacity={1} 
              fill={`url(#color${data.id})`} 
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <div className="h-full w-full rounded-xl bg-slate-100/50" />
        )}
      </div>
    </div>
  );
}
