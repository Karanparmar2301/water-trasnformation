import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { SENSORS } from '../../types';

interface DashboardVerificationPanelProps {
  mode: 'realtime' | 'historical';
  loading: boolean;
  error: string | null;
  warning: string | null;
  sourceTable: string | null;
  lastSync: string | null;
}

interface VerificationCheck {
  id: string;
  title: string;
  detail: string;
  passed: boolean;
  pending?: boolean;
}

export function DashboardVerificationPanel({
  mode,
  loading,
  error,
  warning,
  sourceTable,
  lastSync,
}: DashboardVerificationPanelProps) {
  const { sensors, recentReadings } = useStore();

  const checks = useMemo<VerificationCheck[]>(() => {
    const totalSensors = SENSORS.length;
    const minimumCoverage = Math.max(8, Math.floor(totalSensors * 0.5));
    const sensorsWithHistory = Object.values(sensors).filter((sensor) => sensor.history.length > 0).length;
    const uniqueRecentSensors = new Set(recentReadings.map((reading) => reading.sensor_id)).size;

    const timestamps = recentReadings.map((reading) => new Date(reading.timestamp).getTime());
    const validTimestampCount = timestamps.filter((value) => Number.isFinite(value)).length;
    const isDescendingByTime = timestamps.every((value, index) => index === 0 || timestamps[index - 1] >= value);

    const sourceReady = Boolean(sourceTable);

    return [
      {
        id: 'source',
        title: 'Supabase Source Bound',
        detail: sourceTable ? `Reading from ${sourceTable}` : 'No source table resolved yet',
        passed: sourceReady,
        pending: loading,
      },
      {
        id: 'rows',
        title: 'Rows Loaded Into Dashboard',
        detail: `${recentReadings.length} rows currently in dashboard buffer`,
        passed: recentReadings.length > 0,
        pending: loading,
      },
      {
        id: 'coverage',
        title: 'Sensor Coverage Check',
        detail: `Hydrated ${sensorsWithHistory}/${totalSensors} sensors (minimum ${minimumCoverage}), recent buffer has ${uniqueRecentSensors} unique sensors`,
        passed: sensorsWithHistory >= minimumCoverage && uniqueRecentSensors > 0,
        pending: loading,
      },
      {
        id: 'timestamps',
        title: 'Timestamp Quality Check',
        detail: `${validTimestampCount}/${recentReadings.length} valid timestamps, sorted newest-first: ${isDescendingByTime ? 'yes' : 'no'}`,
        passed: recentReadings.length > 0 && validTimestampCount === recentReadings.length && isDescendingByTime,
        pending: loading,
      },
      {
        id: 'sync',
        title: 'Sync Signal Present',
        detail: lastSync ? `Last sync ${new Date(lastSync).toLocaleString()}` : 'No sync event recorded yet',
        passed: Boolean(lastSync),
        pending: loading,
      },
    ];
  }, [sensors, recentReadings, loading, sourceTable, lastSync]);

  const passedCount = checks.filter((check) => !check.pending && check.passed).length;
  const failedCount = checks.filter((check) => !check.pending && !check.passed).length;
  const pendingCount = checks.filter((check) => check.pending).length;

  const summaryTone = failedCount > 0 ? 'text-rose-700' : pendingCount > 0 ? 'text-amber-700' : 'text-emerald-700';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Dashboard Verification</h2>
          <p className="text-sm text-gray-500">Automated checks for live query and rendering integrity.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 font-medium capitalize">{mode} mode</span>
          <span className={cn('font-semibold', summaryTone)}>
            {passedCount}/{checks.length} passing
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checks.map((check) => {
          const icon = check.pending ? (
            <CircleDashed className="w-5 h-5 text-amber-500" />
          ) : check.passed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-500" />
          );

          return (
            <div
              key={check.id}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                check.pending
                  ? 'bg-amber-50/50 border-amber-100'
                  : check.passed
                    ? 'bg-emerald-50/50 border-emerald-100'
                    : 'bg-rose-50/50 border-rose-100',
              )}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{icon}</div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{check.title}</h3>
                  <p className="text-xs text-gray-600 mt-1 break-words">{check.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-lg px-3 py-2">
          Active data error: {error}
        </div>
      )}

      {!error && warning && (
        <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-700 text-sm rounded-lg px-3 py-2">
          Realtime warning: {warning}
        </div>
      )}
    </div>
  );
}
