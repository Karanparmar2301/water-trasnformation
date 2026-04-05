import { useMemo } from 'react';
import { format } from 'date-fns';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { calculateStatus } from '../../types';

export function ReadingsTable() {
  const { recentReadings, sensors, searchQuery } = useStore();
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredReadings = useMemo(() => {
    if (!normalizedSearch) {
      return recentReadings;
    }

    return recentReadings.filter((reading) => {
      const sensor = sensors[reading.sensor_id];
      if (!sensor) {
        return false;
      }

      const status = calculateStatus(reading.value, sensor).toLowerCase();
      const valueText = reading.value.toFixed(2);

      return (
        sensor.name.toLowerCase().includes(normalizedSearch) ||
        reading.sensor_id.toLowerCase().includes(normalizedSearch) ||
        sensor.unit.toLowerCase().includes(normalizedSearch) ||
        status.includes(normalizedSearch) ||
        valueText.includes(normalizedSearch)
      );
    });
  }, [normalizedSearch, recentReadings, sensors]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">Recent Readings Log</h2>
        <p className="text-sm text-gray-500">
          {normalizedSearch
            ? `Showing ${filteredReadings.length} matching events`
            : 'Last 50 recorded events across all sensors'}
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-medium">Timestamp</th>
              <th className="px-6 py-4 font-medium">Sensor</th>
              <th className="px-6 py-4 font-medium">Value</th>
              <th className="px-6 py-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredReadings.map((reading, i) => {
              const sensor = sensors[reading.sensor_id];
              if (!sensor) return null;
              
              // Calculate status for this specific reading
              const status = calculateStatus(reading.value, sensor);

              return (
                <tr key={`${reading.id}-${i}`} className="hover:bg-sky-50/30 transition-colors">
                  <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                    {format(new Date(reading.timestamp), 'MMM dd, HH:mm:ss')}
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {sensor.name}
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-mono text-gray-700">{reading.value.toFixed(2)}</span>
                    <span className="text-gray-400 ml-1 text-xs">{sensor.unit}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      status === 'Critical' ? "bg-rose-100 text-rose-700" :
                      status === 'Warning' ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}

            {recentReadings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Waiting for sensor data...
                </td>
              </tr>
            )}

            {recentReadings.length > 0 && filteredReadings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No readings match the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
