import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { SensorChart } from './SensorChart';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

export function SensorDetailModal() {
  const { selectedSensorId, setSelectedSensorId, sensors } = useStore();

  if (!selectedSensorId || !sensors[selectedSensorId]) {
    return null;
  }

  const sensor = sensors[selectedSensorId];

  // Provide mapped colors for chart to look premium
  const getChartColor = (status: string) => {
    if (status === 'Critical') return '#f43f5e'; // rose-500
    if (status === 'Warning') return '#f59e0b'; // amber-500
    return '#4FA3C7'; // brand primary
  };

  const statusColors = {
    Normal: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Warning: 'bg-amber-50 text-amber-700 border-amber-100',
    Critical: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  const statusDot = {
    Normal: 'bg-emerald-500',
    Warning: 'bg-amber-500',
    Critical: 'bg-rose-500',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSelectedSensorId(null)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-brand-soft">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{sensor.name} Details</h2>
              <p className="text-sm text-gray-500 mt-1">Real-time deep analysis & historical trend</p>
            </div>
            <button
              onClick={() => setSelectedSensorId(null)}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Top KPI row in modal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 rounded-xl border border-brand-border bg-brand-card shadow-sm">
                <p className="text-sm font-medium text-gray-500 mb-1">Current Reading</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">{sensor.currentValue.toFixed(2)}</span>
                  <span className="text-lg text-gray-400 font-medium">{sensor.unit}</span>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-brand-border bg-brand-card shadow-sm">
                <p className="text-sm font-medium text-gray-500 mb-1">System Status</p>
                <div className={cn("px-4 py-2 mt-2 rounded-full text-sm font-bold border inline-flex items-center gap-2", statusColors[sensor.status])}>
                  <div className={cn("w-2.5 h-2.5 rounded-full", statusDot[sensor.status])} />
                  {sensor.status.toUpperCase()}
                </div>
              </div>

              <div className="p-6 rounded-xl border border-brand-border bg-brand-card shadow-sm">
                <p className="text-sm font-medium text-gray-500 mb-1">Safety Limits</p>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Normal Max:</span>
                    <span className="font-semibold text-gray-900">{sensor.maxNormal} {sensor.unit}</span>
                  </div>
                  {sensor.maxWarning && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-600 font-medium">Warning At:</span>
                      <span className="font-bold text-amber-700">{sensor.maxWarning} {sensor.unit}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="mb-8 h-[400px]">
              <SensorChart data={sensor} color={getChartColor(sensor.status)} />
            </div>

            {/* Recent Table */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-brand-primary" />
                Recent Activity Log
              </h3>
              <div className="overflow-hidden border border-gray-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Timestamp</th>
                      <th className="px-6 py-3 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...sensor.history].reverse().slice(0, 10).map((h, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 text-gray-600">{format(new Date(h.timestamp), 'MMM dd, HH:mm:ss')}</td>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {h.value.toFixed(2)} <span className="text-gray-400 font-normal">{sensor.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
