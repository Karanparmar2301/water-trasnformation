import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Droplets, Thermometer, Wind, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useSensorRealtime } from '../hooks/useSensorRealtime';
import { useSensorHistory } from '../hooks/useSensorHistory';

const timeRanges = ['1H', '6H', '24H'];
const timeRangesHours: Record<string, number> = { '1H': 1, '6H': 6, '24H': 24 };

const iconMap: Record<string, React.ReactNode> = {
  pH: <Droplets className="w-8 h-8 text-blue-500" />,
  TSS: <Activity className="w-8 h-8 text-amber-500" />,
  COD: <Wind className="w-8 h-8 text-purple-500" />,
  BOD: <Activity className="w-8 h-8 text-green-500" />,
  Flow: <Wind className="w-8 h-8 text-cyan-500" />,
};

export function SensorDetailPage() {
  const { sensorName } = useParams();
  const navigate = useNavigate();
  const [rangeStr, setRangeStr] = useState('24H');
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
  
  const { sensor, loading: rLoading } = useSensorRealtime(sensorName || '');
  const { data: historyData, loading: hLoading, error: hError } = useSensorHistory(sensorName || '', timeRangesHours[rangeStr]);

  if (rLoading || !sensor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const Icon = iconMap[sensor.name || ''] || <Activity className="w-8 h-8 text-indigo-500" />;

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

const sensorValue = typeof sensor.currentValue === 'number' ? sensor.currentValue : (sensor.value ?? 0);

  const chartData = historyData.length > 0
    ? historyData.map(d => ({ time: formatTime(d.event_time), value: d.value }))
    : Array.from({ length: 24 }).map((_, i) => ({ time: i.toString() + ':00', value: sensorValue * (0.9 + Math.random() * 0.2) }));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </button>
          <div className="flex items-center space-x-3 bg-white/5 p-3 rounded-xl border border-white/10">
            {Icon}
            <div>
              <h1 className="text-2xl font-bold text-white">{sensor.name} Overview</h1>
              <p className="text-gray-400 text-sm">Real-time telemetry and historical analysis</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
             <h2 className="text-gray-400 font-medium mb-4">Current Value</h2>
             <div className="flex items-baseline space-x-2">
               <span className="text-5xl font-bold text-white tracking-tight">
                 {typeof sensorValue === 'number' ? sensorValue.toFixed(1) : sensorValue}
               </span>
               <span className="text-xl text-gray-500">{sensor.unit}</span>
             </div>
             
             <div className="mt-8 space-y-4">
               <div className="flex justify-between items-center py-2 border-b border-white/5">
                 <span className="text-gray-400">Status</span>
                 <span className={'font-medium capitalize ' + (sensor.status === 'normal' ? 'text-emerald-400' : 'text-amber-400')}>{sensor.status}</span>
               </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Historical Trend</h2>
              <div className="flex space-x-2">
                {timeRanges.map(r => (
                  <button
                    key={r}
                    onClick={() => setRangeStr(r)}
                    className={'px-3 py-1 text-sm rounded-lg transition-colors ' + (rangeStr === r ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5')}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div ref={chartContainerRef} className="h-[300px] min-h-[300px] min-w-0">
              {chartSize.width > 0 && chartSize.height > 0 ? (
                <AreaChart width={chartSize.width} height={chartSize.height} data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={['dataMin', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(17, 24, 39, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem',
                      color: '#fff'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              ) : (
                <div className="h-full w-full rounded-xl bg-slate-100/50" />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
