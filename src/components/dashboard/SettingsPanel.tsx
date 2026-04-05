import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BellRing, Clock3, Search as SearchIcon, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SENSORS } from '../../types';
import { useStore } from '../../store/useStore';

const HISTORICAL_HOUR_OPTIONS = [6, 12, 24, 48, 72];

interface SettingsPanelProps {
  dataStatus: { loading: boolean; error: string | null; warning: string | null };
}

export function SettingsPanel({ dataStatus }: SettingsPanelProps) {
  const {
    isRealtime,
    setRealtimeMode,
    historicalHours,
    setHistoricalHours,
    preserveSearchAcrossTabs,
    setPreserveSearchAcrossTabs,
    notifyOnCritical,
    notifyOnWarning,
    setNotifyOnCritical,
    setNotifyOnWarning,
    searchQuery,
    clearSearch,
    sensors,
    updateSensorThresholds,
    resetSensorThresholds,
    setActiveTab,
  } = useStore();

  const sensorOptions = useMemo(
    () => Object.values(sensors).sort((left, right) => left.id.localeCompare(right.id)),
    [sensors],
  );

  const [selectedSensorId, setSelectedSensorId] = useState(sensorOptions[0]?.id ?? 's1');
  const [minNormalInput, setMinNormalInput] = useState('');
  const [maxNormalInput, setMaxNormalInput] = useState('');
  const [maxWarningInput, setMaxWarningInput] = useState('');
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [thresholdSuccess, setThresholdSuccess] = useState<string | null>(null);

  const selectedSensor = sensors[selectedSensorId];
  const previousSelectedSensorId = useRef<string | null>(null);
  const criticalCount = sensorOptions.filter((sensor) => sensor.status === 'Critical').length;
  const warningCount = sensorOptions.filter((sensor) => sensor.status === 'Warning').length;
  const normalCount = Math.max(0, sensorOptions.length - criticalCount - warningCount);
  const enabledAlertChannels = Number(notifyOnCritical) + Number(notifyOnWarning);
  const normalizedSearch = searchQuery.trim();

  const dataHealth = dataStatus.loading
    ? 'Loading'
    : dataStatus.error
      ? 'Error'
      : dataStatus.warning
        ? 'Warning'
        : 'Ready';

  const dataHealthTone = dataStatus.error
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : dataStatus.warning
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  useEffect(() => {
    if (sensorOptions.length > 0 && !sensors[selectedSensorId]) {
      setSelectedSensorId(sensorOptions[0].id);
    }
  }, [selectedSensorId, sensorOptions, sensors]);

  useEffect(() => {
    if (!selectedSensor) {
      return;
    }

    if (previousSelectedSensorId.current === selectedSensorId) {
      return;
    }

    previousSelectedSensorId.current = selectedSensorId;
    setMinNormalInput(String(selectedSensor.minNormal));
    setMaxNormalInput(String(selectedSensor.maxNormal));
    setMaxWarningInput(String(selectedSensor.maxWarning));
    setThresholdError(null);
    setThresholdSuccess(null);
  }, [selectedSensor, selectedSensorId]);

  const handleApplyThresholds = () => {
    if (!selectedSensor) {
      return;
    }

    const minNormal = Number(minNormalInput);
    const maxNormal = Number(maxNormalInput);
    const maxWarning = Number(maxWarningInput);

    if (!Number.isFinite(minNormal) || !Number.isFinite(maxNormal) || !Number.isFinite(maxWarning)) {
      setThresholdError('Enter valid numeric threshold values.');
      setThresholdSuccess(null);
      return;
    }

    if (maxNormal < minNormal) {
      setThresholdError('Max normal must be greater than or equal to min normal.');
      setThresholdSuccess(null);
      return;
    }

    if (maxWarning < maxNormal) {
      setThresholdError('Max warning must be greater than or equal to max normal.');
      setThresholdSuccess(null);
      return;
    }

    updateSensorThresholds(selectedSensor.id, {
      minNormal,
      maxNormal,
      maxWarning,
    });

    setThresholdError(null);
    setThresholdSuccess(`Thresholds updated for ${selectedSensor.name}.`);
  };

  const handleResetThresholds = () => {
    if (!selectedSensor) {
      return;
    }

    resetSensorThresholds(selectedSensor.id);

    const defaults = SENSORS.find((sensor) => sensor.id === selectedSensor.id);
    if (defaults) {
      setMinNormalInput(String(defaults.minNormal));
      setMaxNormalInput(String(defaults.maxNormal));
      setMaxWarningInput(String(defaults.maxWarning));
    }

    setThresholdError(null);
    setThresholdSuccess(`Thresholds reset for ${selectedSensor.name}.`);
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <article className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Monitoring Mode</p>
            <Clock3 className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{isRealtime ? 'Real-time' : 'Historical'}</p>
          <p className="mt-1 text-xs text-slate-600">Window: {historicalHours} hours</p>
        </article>

        <article className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Alerts Enabled</p>
            <BellRing className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{enabledAlertChannels}/2</p>
          <p className="mt-1 text-xs text-slate-600">Critical and warning channels</p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Active Alarms</p>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{criticalCount + warningCount}</p>
          <p className="mt-1 text-xs text-slate-600">Critical: {criticalCount} | Warning: {warningCount}</p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">System Health</p>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{normalCount}</p>
          <p className="mt-1 text-xs text-slate-600">Sensors in normal state</p>
        </article>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Monitoring Mode</h2>
          <p className="text-sm text-gray-600 mt-1">Control live mode and historical data loading window.</p>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setRealtimeMode(true)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                isRealtime ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              )}
            >
              Real-time
            </button>
            <button
              onClick={() => {
                setRealtimeMode(false);
              }}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                !isRealtime ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              )}
            >
              Historical
            </button>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Historical window</label>
            <div className="flex items-center gap-3">
              <select
                value={historicalHours}
                onChange={(event) => {
                  const nextHours = Number(event.target.value);
                  setHistoricalHours(nextHours);
                }}
                className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              >
                {HISTORICAL_HOUR_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>
                    Last {hours} hours
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setRealtimeMode(false);
                }}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:opacity-90"
              >
                Load Window
              </button>
            </div>
          </div>

          <div className={cn('mt-4 rounded-lg border px-3 py-2 text-xs font-medium', dataHealthTone)}>
            <p>
              Data status: {dataHealth}
              {dataStatus.error ? ` - ${dataStatus.error}` : ''}
              {!dataStatus.error && dataStatus.warning ? ` - ${dataStatus.warning}` : ''}
            </p>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Alerts and Search</h2>
          <p className="text-sm text-gray-600 mt-1">Configure notifications and search behavior.</p>

          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-sm text-gray-800">Critical notifications</span>
              <input
                type="checkbox"
                checked={notifyOnCritical}
                onChange={(event) => setNotifyOnCritical(event.target.checked)}
                className="h-4 w-4 accent-brand-primary"
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-sm text-gray-800">Warning notifications</span>
              <input
                type="checkbox"
                checked={notifyOnWarning}
                onChange={(event) => setNotifyOnWarning(event.target.checked)}
                className="h-4 w-4 accent-brand-primary"
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-sm text-gray-800">Keep search text when changing tabs</span>
              <input
                type="checkbox"
                checked={preserveSearchAcrossTabs}
                onChange={(event) => setPreserveSearchAcrossTabs(event.target.checked)}
                className="h-4 w-4 accent-brand-primary"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={clearSearch}
              disabled={!normalizedSearch}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                normalizedSearch
                  ? 'border-gray-300 text-gray-800 hover:bg-gray-50'
                  : 'border-gray-200 text-gray-400 cursor-not-allowed',
              )}
            >
              Clear Search
            </button>
            <button
              onClick={() => setActiveTab('alarms')}
              className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:opacity-90"
            >
              Open Alarms Center
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-2">
            <SearchIcon className="h-3.5 w-3.5 text-gray-500" />
            <p className="text-xs text-gray-600">
              Current search:{' '}
              <span className="font-semibold text-gray-800">{normalizedSearch || 'No active search query'}</span>
            </p>
          </div>
        </section>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Sensor Threshold Management</h2>
        <p className="text-sm text-gray-600 mt-1">Adjust min normal, max normal, and max warning values per sensor.</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sensor</label>
            <select
              value={selectedSensorId}
              onChange={(event) => setSelectedSensorId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            >
              {sensorOptions.map((sensor) => (
                <option key={sensor.id} value={sensor.id}>
                  {sensor.id.toUpperCase()} - {sensor.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min normal</label>
            <input
              type="number"
              value={minNormalInput}
              onChange={(event) => setMinNormalInput(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max normal</label>
            <input
              type="number"
              value={maxNormalInput}
              onChange={(event) => setMaxNormalInput(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max warning</label>
            <input
              type="number"
              value={maxWarningInput}
              onChange={(event) => setMaxWarningInput(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleApplyThresholds}
            className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:opacity-90"
          >
            Save Thresholds
          </button>
          <button
            onClick={handleResetThresholds}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Reset to Default
          </button>

          {selectedSensor && (
            <span className="text-xs text-gray-600">
              Current value: <span className="font-semibold text-gray-800">{selectedSensor.currentValue.toFixed(2)}</span>{' '}
              {selectedSensor.unit} | Status: <span className="font-semibold text-gray-800">{selectedSensor.status}</span>
            </span>
          )}
        </div>

        {thresholdError && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {thresholdError}
          </div>
        )}

        {thresholdSuccess && !thresholdError && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {thresholdSuccess}
          </div>
        )}
      </section>
    </div>
  );
}
