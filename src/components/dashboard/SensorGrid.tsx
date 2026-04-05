import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useSensorModalStore } from '../../store/useSensorModalStore';
import { SensorModal } from './SensorModal';

function getSparklineColor(status: string | undefined): string {
  const normalizedStatus = status?.toLowerCase();
  if (normalizedStatus === 'critical') {
    return '#ef4444';
  }

  if (normalizedStatus === 'warning') {
    return '#f59e0b';
  }

  return '#10b981';
}

function buildSparklinePoints(history: Array<{ value: number }> | undefined, fallbackValue: number): string {
  const sampledValues = Array.isArray(history)
    ? history
        .slice(-16)
        .map((point) => Number(point.value))
        .filter((value) => Number.isFinite(value))
    : [];

  const values = sampledValues.length > 0 ? sampledValues : Array.from({ length: 16 }, () => fallbackValue);

  if (values.length === 0) {
    return '';
  }

  const width = 120;
  const height = 28;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

const CLICKABLE_SENSOR_IDS = new Set([
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  's7',
  's8',
  's9',
  's10',
  's11',
  's12',
  's13',
  's14',
  's15',
  's16',
  's17',
  's18',
  's19',
  's20',
]);

export function SensorGrid() {
  const { sensors, searchQuery } = useStore();
  const openModal = useSensorModalStore((state) => state.openModal);
  const sensorList = Object.values(sensors);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSensors = normalizedSearch
    ? sensorList.filter((sensor: any) => {
        const name = String(sensor.name ?? '').toLowerCase();
        const id = String(sensor.id ?? '').toLowerCase();
        const unit = String(sensor.unit ?? '').toLowerCase();
        const status = String(sensor.status ?? '').toLowerCase();

        return (
          name.includes(normalizedSearch) ||
          id.includes(normalizedSearch) ||
          unit.includes(normalizedSearch) ||
          status.includes(normalizedSearch)
        );
      })
    : sensorList;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredSensors.map((sensor: any, index: number) => {
          const isClickable = CLICKABLE_SENSOR_IDS.has(sensor.id);
          const sensorValue =
            typeof sensor.currentValue === 'number'
              ? sensor.currentValue
              : typeof sensor.value === 'number'
                ? sensor.value
                : 0;
          const sparklinePoints = buildSparklinePoints(sensor.history, sensorValue);
          const sparklineColor = getSparklineColor(sensor.status);

          return (
            <motion.div
              key={sensor.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={isClickable ? { scale: 1.02 } : undefined}
              onClick={isClickable ? () => openModal(sensor) : undefined}
              onKeyDown={
                isClickable
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openModal(sensor);
                      }
                    }
                  : undefined
              }
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : -1}
              className={
                'bg-white/80 border border-gray-200 rounded-xl p-4 hover:bg-white transition-colors shadow-sm ' +
                (isClickable ? 'cursor-pointer hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]' : '')
              }
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-slate-600 font-semibold">{sensor.name}</h3>
                <span
                  className={
                    'w-2 h-2 rounded-full ' +
                    (sensor.status?.toLowerCase() === 'critical'
                      ? 'bg-red-500'
                      : sensor.status?.toLowerCase() === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500')
                  }
                />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-4xl font-bold text-gray-900 tracking-tight">
                  {sensorValue.toFixed(1)}
                </span>
                <span className="text-xl text-gray-700 font-medium">{sensor.unit}</span>
              </div>
              <div className="mt-3">
                <svg
                  viewBox="0 0 120 28"
                  className="h-8 w-full"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polyline
                    points={sparklinePoints}
                    fill="none"
                    stroke={sparklineColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </motion.div>
          );
        })}

        {filteredSensors.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
            <h3 className="text-base font-semibold text-slate-800">No sensors match this search</h3>
            <p className="mt-1 text-sm text-slate-600">Try searching by sensor name, id, unit, or status.</p>
          </div>
        )}
      </div>

      <SensorModal />
    </>
  );
}
