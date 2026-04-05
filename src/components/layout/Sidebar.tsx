import { Activity, Droplets, Settings, LayoutDashboard, History, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';

export function Sidebar() {
  const { activeTab, setActiveTab, recentReadings } = useStore();

  const hasReadings = recentReadings.length > 0;

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'live', icon: Activity, label: 'Live Monitoring' },
    { id: 'historical', icon: History, label: 'Historical Data' },
    { id: 'alarms', icon: AlertTriangle, label: 'Alarms' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-brand-primary to-brand-tertiary border-r border-brand-border h-screen flex flex-col shadow-lg">
      <div className="p-6 flex items-center gap-3 mx-3 mt-4 rounded-xl transition-all duration-200 hover:bg-white/20 hover:-translate-y-0.5 group">
        <div className="bg-white/30 p-2 rounded-lg transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-6 backdrop-blur-sm">
          <Droplets className="w-6 h-6 text-gray-900" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 leading-tight">Smart STP</h1>
          <p className="text-xs text-gray-800 font-medium">Monitoring System</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "group w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform-gpu hover:-translate-y-0.5",
              activeTab === item.id
                ? "bg-white/40 text-gray-900 shadow-md backdrop-blur-sm"
                : "text-gray-800 hover:bg-white/20 hover:text-gray-900"
            )}
          >
            <item.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 m-4 bg-white/20 rounded-xl border border-white/30 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-2 h-2 rounded-full', hasReadings ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500')} />
          <span className="text-sm font-bold text-gray-900">System Status</span>
        </div>
        <p className="text-xs text-gray-800 font-medium">
          {hasReadings ? 'Live sensor data is streaming.' : 'Waiting for live readings...'}
        </p>
      </div>    
    </aside>
  );
}
