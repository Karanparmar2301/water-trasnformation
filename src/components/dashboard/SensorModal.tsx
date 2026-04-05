import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { useSensorModalStore } from '../../store/useSensorModalStore';
import { SensorModalChart } from './SensorModalChart';
import { useSensorRealtime } from '../../hooks/useSensorRealtime';
import { useSensorHistory } from '../../hooks/useSensorHistory';

type SensorRange = '1h' | '6h' | '24h';

const RANGE_OPTIONS: Array<{ label: string; value: SensorRange }> = [
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
];

export function SensorModal() {
  const selectedSensor = useSensorModalStore((state) => state.selectedSensor);
  const isModalOpen = useSensorModalStore((state) => state.isModalOpen);
  const closeModal = useSensorModalStore((state) => state.closeModal);
  const [range, setRange] = useState<SensorRange>('1h');

  const sensorName = isModalOpen && selectedSensor ? selectedSensor.name : '';
  const { reading } = useSensorRealtime(sensorName);
  const { data: historyData, loading: historyLoading, error: historyError, stats } = useSensorHistory(sensorName, range);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isModalOpen, closeModal]);

  useEffect(() => {
    if (!isModalOpen) {
      setRange('1h');
    }
  }, [isModalOpen]);

  const chartPoints = useMemo(() => {
    const historyPoints = historyData.map((item) => ({ timestamp: item.timestamp, value: item.value }));
    const merged = reading ? [...historyPoints, { timestamp: reading.timestamp, value: reading.value }] : historyPoints;

    const dedupedByTimestamp = new Map<string, { timestamp: string; value: number }>();
    merged.forEach((point) => {
      dedupedByTimestamp.set(point.timestamp, point);
    });

    return [...dedupedByTimestamp.values()]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-20);
  }, [historyData, reading]);

  const sensorStats = useMemo(() => {
    if (chartPoints.length === 0) {
      return stats;
    }

    const values = chartPoints.map((point) => point.value);
    const total = values.reduce((sum, value) => sum + value, 0);

    return {
      avg: total / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [chartPoints, stats]);

  if (!selectedSensor) {
    return null;
  }

  const currentValue = reading?.value ?? selectedSensor.currentValue ?? 0;
  const currentUnit = reading?.unit || selectedSensor.unit;
  const lastUpdated = reading?.timestamp || chartPoints[chartPoints.length - 1]?.timestamp;
  const status = selectedSensor.status || 'Normal';

  const statusClasses =
    status === 'Critical'
      ? 'bg-red-50 text-red-700 border-red-200'
      : status === 'Warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-[700px] rounded-2xl bg-white shadow-2xl border border-gray-100"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-gray-900">{selectedSensor.name}</h3>
                  <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${statusClasses}`}>
                    {status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="Close sensor modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-sm text-gray-500">Current Value</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-gray-900 tracking-tight">{currentValue.toFixed(2)}</span>
                  <span className="text-base text-gray-500 mb-1">{currentUnit}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {lastUpdated ? format(new Date(lastUpdated), 'MMM dd, yyyy HH:mm:ss') : 'No recent data'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Historical Range</h4>
                  <div className="flex items-center gap-2">
                    {RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRange(option.value)}
                        className={
                          range === option.value
                            ? 'px-3 py-1.5 text-xs rounded-lg bg-[#4FA3C7] text-white font-medium'
                            : 'px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors'
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {historyError && <p className="mb-3 text-xs text-red-600">{historyError}</p>}
                {historyLoading && <p className="mb-3 text-xs text-gray-500">Loading sensor history...</p>}

                <SensorModalChart points={chartPoints} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">Average</p>
                  <p className="text-lg font-semibold text-gray-900">{sensorStats.avg.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">Min</p>
                  <p className="text-lg font-semibold text-gray-900">{sensorStats.min.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">Max</p>
                  <p className="text-lg font-semibold text-gray-900">{sensorStats.max.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}