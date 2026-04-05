import { AlertTriangle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { KPICard } from '../components/dashboard/KPICard';
import { SensorChart } from '../components/dashboard/SensorChart';
import { SensorGrid } from '../components/dashboard/SensorGrid';
import { ReadingsTable } from '../components/dashboard/ReadingsTable';
import { SettingsPanel } from '../components/dashboard/SettingsPanel';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';

interface DashboardViewProps {
  activeDataStatus: { loading: boolean; error: string | null; warning: string | null };
}

export function DashboardView({ activeDataStatus }: DashboardViewProps) {
  const { sensors, isRealtime, activeTab, searchQuery } = useStore();

  const kpiSensors = ['s1', 's2', 's3', 's4']; // BOD, COD, pH, TSS
  const chartSensors = ['s1', 's2'];
  const chartColors: Record<string, string> = {
    s1: '#4FA3C7',
    s2: '#8b5cf6',
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const matchesSearch = (sensor: any) => {
    if (!normalizedSearch || !sensor) {
      return true;
    }

    const searchableText = [
      String(sensor.id ?? ''),
      String(sensor.name ?? ''),
      String(sensor.unit ?? ''),
      String(sensor.status ?? ''),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  };

  const filteredKpiSensors = kpiSensors.filter((id) => matchesSearch(sensors[id]));
  const filteredChartSensors = chartSensors.filter((id) => matchesSearch(sensors[id]));
  const sensorList = Object.values(sensors);
  const criticalSensors = sensorList.filter((sensor) => sensor.status === 'Critical');
  const warningSensors = sensorList.filter((sensor) => sensor.status === 'Warning');
  const normalSensorsCount = Math.max(0, sensorList.length - criticalSensors.length - warningSensors.length);

  // Custom Alarms View
  const alarmSensors = Object.values(sensors).filter((s) => s.status !== 'Normal' && matchesSearch(s));
  const filteredCriticalCount = alarmSensors.filter((sensor) => sensor.status === 'Critical').length;
  const filteredWarningCount = alarmSensors.filter((sensor) => sensor.status === 'Warning').length;

  return (
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === 'dashboard' && 'Plant Overview'}
            {activeTab === 'live' && 'Live Monitoring'}
            {activeTab === 'historical' && 'Historical Data'}
            {activeTab === 'alarms' && 'System Alarms'}
            {activeTab === 'settings' && 'Settings'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isRealtime ? 'Live monitoring active. Data updates every minute.' : 'Viewing historical data for the last 24 hours.'}
          </p>
        </div>

        {activeDataStatus.loading && (
          <div className="bg-sky-50 border border-sky-100 text-sky-700 rounded-xl px-4 py-3 text-sm">
            Loading data from Supabase...
          </div>
        )}

        {!activeDataStatus.loading && activeDataStatus.error && (      
          <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-3 text-sm">
            {activeDataStatus.error}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredKpiSensors.map(id => (
                sensors[id] && <KPICard key={id} data={sensors[id]} /> 
              ))}

              {filteredKpiSensors.length === 0 && (
                <div className="md:col-span-2 lg:col-span-4 rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
                  <h3 className="text-base font-semibold text-slate-800">No KPI cards match this search</h3>
                  <p className="mt-1 text-sm text-slate-600">Try searching for BOD, COD, pH, TSS, or status.</p>
                </div>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">    
              {filteredChartSensors.map((id) => {
                const sensor = sensors[id];
                if (!sensor) {
                  return null;
                }

                return <SensorChart key={id} data={sensor} color={chartColors[id] ?? '#4FA3C7'} />;
              })}

              {filteredChartSensors.length === 0 && (
                <div className="lg:col-span-2 rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
                  <h3 className="text-base font-semibold text-slate-800">No chart sensors match this search</h3>
                  <p className="mt-1 text-sm text-slate-600">Clear search to view full chart analytics.</p>
                </div>
              )}
            </div>

            {/* Full Sensor Grid */}
            <SensorGrid />

            {/* Readings Table */}
            <ReadingsTable />
          </>
        )}

        {activeTab === 'live' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {filteredKpiSensors.map(id => (
                sensors[id] && <KPICard key={id} data={sensors[id]} /> 
              ))}

              {filteredKpiSensors.length === 0 && (
                <div className="md:col-span-2 lg:col-span-4 rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
                  <h3 className="text-base font-semibold text-slate-800">No KPI cards match this search</h3>
                  <p className="mt-1 text-sm text-slate-600">Clear search to monitor all live KPI cards.</p>
                </div>
              )}
            </div>
            {/* Full Sensor Grid */}
            <SensorGrid />
          </>
        )}

        {activeTab === 'historical' && (
          <>
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {filteredChartSensors.map((id) => {
                const sensor = sensors[id];
                if (!sensor) {
                  return null;
                }

                return <SensorChart key={id} data={sensor} color={chartColors[id] ?? '#4FA3C7'} />;
              })}

              {filteredChartSensors.length === 0 && (
                <div className="lg:col-span-2 rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
                  <h3 className="text-base font-semibold text-slate-800">No chart sensors match this search</h3>
                  <p className="mt-1 text-sm text-slate-600">Clear search to view full historical analytics.</p>
                </div>
              )}
            </div>
            {/* Readings Table */}
            <ReadingsTable />
          </>
        )}

        {activeTab === 'alarms' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Critical Alarms</p>
                  <TriangleAlert className="h-4 w-4 text-rose-600" />
                </div>
                <p className="mt-3 text-3xl font-bold text-slate-900">{criticalSensors.length}</p>
                <p className="mt-1 text-xs text-slate-600">{filteredCriticalCount} shown in current view</p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Warning Alarms</p>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <p className="mt-3 text-3xl font-bold text-slate-900">{warningSensors.length}</p>
                <p className="mt-1 text-xs text-slate-600">{filteredWarningCount} shown in current view</p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Normal Sensors</p>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-bold text-slate-900">{normalSensorsCount}</p>
                <p className="mt-1 text-xs text-slate-600">Stable and within configured limits</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Active Alarms</h2>
                <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                  {alarmSensors.length} active in current view
                </span>
              </div>

              {alarmSensors.length > 0 ? (
                <div className="space-y-3">
                  {alarmSensors.map((sensor) => {
                    const isCritical = sensor.status === 'Critical';
                    const badgeClass = isCritical
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200';
                    const panelClass = isCritical
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-amber-50/70 border-amber-200';
                    const accentClass = isCritical ? 'bg-rose-500' : 'bg-amber-500';
                    const guidanceText = isCritical ? 'Immediate attention required' : 'Monitor closely';

                    return (
                      <article key={sensor.id} className={cn('rounded-xl border p-4', panelClass)}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={cn('w-2.5 h-2.5 rounded-full', accentClass)} />
                              <h3 className="font-semibold text-slate-900">{sensor.name}</h3>
                              <span className="text-xs text-slate-500 bg-white/70 border border-slate-200 rounded-full px-2 py-0.5">
                                {sensor.id.toUpperCase()}
                              </span>
                            </div>

                            <p className="text-sm text-slate-700 mt-1">
                              Value {sensor.currentValue.toFixed(2)} {sensor.unit} is outside normal range ({sensor.minNormal.toFixed(2)} to{' '}
                              {sensor.maxNormal.toFixed(2)} {sensor.unit}).
                            </p>

                            <p className="text-xs text-slate-600 mt-1">Action: {guidanceText}</p>
                          </div>

                          <div className="md:text-right">
                            <span className={cn('inline-flex px-3 py-1 rounded-full text-xs font-semibold', badgeClass)}>
                              {sensor.status}
                            </span>
                            <p className="mt-2 text-2xl font-bold text-slate-900 leading-none">
                              {sensor.currentValue.toFixed(2)}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">{sensor.unit}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-14">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">All Systems Normal</h3>
                  <p className="text-slate-500 mt-1">
                    {normalizedSearch
                      ? 'No alarms match your current search filter.'
                      : 'No active alarms or warnings at this time.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsPanel dataStatus={activeDataStatus} />
        )}
      </div>
  );
}
