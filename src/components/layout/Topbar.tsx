import { Bell, CheckCheck, Clock3, Search, Settings, ShieldCheck, User, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSensorModalStore } from '../../store/useSensorModalStore';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

type NotificationLevel = 'critical' | 'warning' | 'info';

interface NotificationItem {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  sensorId?: string;
  timestamp?: string;
}

function formatNotificationTime(timestamp?: string): string {
  if (!timestamp) {
    return 'Live';
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'Live';
  }

  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Topbar() {
  const {
    isRealtime,
    toggleMode,
    searchQuery,
    setSearchQuery,
    clearSearch,
    sensors,
    recentReadings,
    setActiveTab,
    setSelectedSensorId,
    notifyOnCritical,
    notifyOnWarning,
  } = useStore();
  const openModal = useSensorModalStore((state) => state.openModal);

  const [now, setNow] = useState(() => new Date());
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const timeText = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [now],
  );

  const dateText = useMemo(
    () =>
      now.toLocaleDateString([], {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [now],
  );

  const latestTimestampBySensorId = useMemo(() => {
    const map = new Map<string, string>();

    for (const reading of recentReadings) {
      if (!map.has(reading.sensor_id)) {
        map.set(reading.sensor_id, reading.timestamp);
      }
    }

    return map;
  }, [recentReadings]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const alertSensors = Object.values(sensors)
      .filter((sensor) => {
        if (sensor.status === 'Critical') {
          return notifyOnCritical;
        }

        if (sensor.status === 'Warning') {
          return notifyOnWarning;
        }

        return false;
      })
      .sort((left, right) => {
        if (left.status === right.status) {
          return left.name.localeCompare(right.name);
        }

        return left.status === 'Critical' ? -1 : 1;
      });

    const items = alertSensors.map<NotificationItem>((sensor) => {
      const value = typeof sensor.currentValue === 'number' ? sensor.currentValue : 0;

      return {
        id: `${sensor.id}-${sensor.status}`,
        level: sensor.status === 'Critical' ? 'critical' : 'warning',
        title: `${sensor.name} ${sensor.status}`,
        message: `Current value ${value.toFixed(2)} ${sensor.unit} is outside the normal range.`,
        sensorId: sensor.id,
        timestamp: latestTimestampBySensorId.get(sensor.id),
      };
    });

    if (items.length === 0) {
      items.push({
        id: 'all-normal',
        level: 'info',
        title: notifyOnCritical || notifyOnWarning ? 'All systems normal' : 'Notifications muted',
        message:
          notifyOnCritical || notifyOnWarning
            ? 'No warning or critical notifications at this moment.'
            : 'Enable warning or critical notifications from Settings.',
      });
    }

    return items;
  }, [latestTimestampBySensorId, notifyOnCritical, notifyOnWarning, sensors]);

  const unreadCount = notifications.filter(
    (notification) => notification.level !== 'info' && !readNotificationIds.includes(notification.id),
  ).length;

  const criticalCount = Object.values(sensors).filter((sensor) => sensor.status === 'Critical').length;
  const warningCount = Object.values(sensors).filter((sensor) => sensor.status === 'Warning').length;
  const normalCount = Math.max(0, Object.keys(sensors).length - criticalCount - warningCount);

  useEffect(() => {
    setReadNotificationIds((previousIds) =>
      previousIds.filter((id) => notifications.some((notification) => notification.id === id)),
    );
  }, [notifications]);

  useEffect(() => {
    const closeMenusOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setIsNotificationOpen(false);
      }

      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenusOnOutsideClick);

    return () => {
      document.removeEventListener('mousedown', closeMenusOnOutsideClick);
    };
  }, []);

  const openFirstSearchMatch = () => {
    if (!normalizedSearch) {
      return;
    }

    const matchedSensor = Object.values(sensors).find((sensor) => {
      const searchableText = [sensor.id, sensor.name, sensor.unit, sensor.status].join(' ').toLowerCase();
      return searchableText.includes(normalizedSearch);
    });

    setActiveTab('dashboard');

    if (matchedSensor) {
      setSelectedSensorId(matchedSensor.id);
      openModal(matchedSensor);
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    setReadNotificationIds((previousIds) =>
      previousIds.includes(notification.id) ? previousIds : [...previousIds, notification.id],
    );
    setIsNotificationOpen(false);

    if (!notification.sensorId) {
      setActiveTab('alarms');
      return;
    }

    const sensor = sensors[notification.sensorId];
    if (!sensor) {
      setActiveTab('alarms');
      return;
    }

    setSelectedSensorId(sensor.id);
    setActiveTab('dashboard');
    openModal(sensor);
  };

  const handleAdminAction = (tab: string) => {
    setActiveTab(tab);
    setIsUserMenuOpen(false);
  };

  return (
    <header className="h-20 bg-brand-secondary px-8 flex items-center justify-between sticky top-0 z-10 text-slate-900">
      <div className="flex items-center gap-6">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            openFirstSearchMatch();
          }}
        >
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                clearSearch();
              }
            }}
            placeholder="Search sensors, status, unit..."
            className="pl-10 pr-20 py-2 bg-white/90 border border-white/70 rounded-full text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-white outline-none w-72 transition-all shadow-inner"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold rounded-full bg-brand-primary text-white"
          >
            Go
          </button>
        </form>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-3 rounded-xl bg-white/95 border border-white/70 px-3 py-2 shadow-sm">
          <Clock3 className="w-4 h-4 text-brand-primary" />
          <div className="leading-tight">
            <p className="text-xs text-slate-600 font-medium">Live Time</p>
            <p className="text-sm md:text-base font-semibold text-slate-900 tabular-nums">{timeText}</p>
          </div>
          <span className="hidden md:block text-xs text-slate-600 border-l border-slate-200 pl-3">{dateText}</span>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center bg-white/60 p-1 rounded-full shadow-inner border border-white/50">
          <button
            onClick={() => !isRealtime && toggleMode()}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
              isRealtime ? "bg-brand-primary text-white shadow-sm" : "text-slate-700 hover:text-slate-900"
            )}
          >
            Real-time
          </button>
          <button
            onClick={() => isRealtime && toggleMode()}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
              !isRealtime ? "bg-brand-primary text-white shadow-sm" : "text-slate-700 hover:text-slate-900"
            )}
          >
            Historical
          </button>
        </div>

        <div className="w-px h-8 bg-slate-300/70" />

        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => {
              setIsNotificationOpen((open) => !open);
              setIsUserMenuOpen(false);
            }}
            className="relative p-2 text-slate-700 hover:text-slate-900 transition-colors"
            aria-label="Open notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center border-2 border-brand-secondary">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-brand-secondary" />
            )}
          </button>

          {isNotificationOpen && (
            <div className="absolute right-0 mt-3 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Notifications</p>
                  <p className="text-xs text-slate-500">{criticalCount} critical, {warningCount} warning</p>
                </div>
                <button
                  onClick={() => setReadNotificationIds(notifications.map((notification) => notification.id))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-primary/80"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notification) => {
                  const isUnread = !readNotificationIds.includes(notification.id) && notification.level !== 'info';

                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-slate-100 transition-colors',
                        notification.level === 'critical' && 'hover:bg-rose-50',
                        notification.level === 'warning' && 'hover:bg-amber-50',
                        notification.level === 'info' && 'hover:bg-emerald-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full',
                                notification.level === 'critical' && 'bg-rose-500',
                                notification.level === 'warning' && 'bg-amber-500',
                                notification.level === 'info' && 'bg-emerald-500',
                              )}
                            />
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">{notification.message}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-slate-500">{formatNotificationTime(notification.timestamp)}</p>
                          {isUnread && <span className="inline-block mt-1 w-2 h-2 rounded-full bg-brand-primary" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setActiveTab('alarms');
                  setIsNotificationOpen(false);
                }}
                className="w-full px-4 py-2.5 text-sm font-semibold text-brand-primary border-t border-slate-100 hover:bg-slate-50"
              >
                Open Alarms Center
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => {
              setIsUserMenuOpen((open) => !open);
              setIsNotificationOpen(false);
            }}
            className="flex items-center gap-3 pl-2"
            aria-label="Open admin user menu"
          >
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-slate-900">Admin User</p>
              <p className="text-xs text-slate-700">Plant Manager</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-brand-primary border-2 border-white shadow-sm">
              <User className="w-5 h-5" />
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                <p className="text-sm font-semibold text-slate-900">Admin Quick Panel</p>
                <p className="text-xs text-slate-600">KPI and plant operation shortcuts</p>
              </div>

              <div className="grid grid-cols-3 gap-2 p-4">
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center">
                  <p className="text-xs text-rose-700">Critical</p>
                  <p className="text-lg font-bold text-rose-800">{criticalCount}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
                  <p className="text-xs text-amber-700">Warning</p>
                  <p className="text-lg font-bold text-amber-800">{warningCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                  <p className="text-xs text-emerald-700">Normal</p>
                  <p className="text-lg font-bold text-emerald-800">{normalCount}</p>
                </div>
              </div>

              <div className="px-2 pb-3 space-y-1">
                <button
                  onClick={() => handleAdminAction('dashboard')}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  <ShieldCheck className="w-4 h-4 text-brand-primary" />
                  Open KPI Dashboard
                </button>
                <button
                  onClick={() => handleAdminAction('live')}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  <Clock3 className="w-4 h-4 text-brand-primary" />
                  Open Live Monitoring
                </button>
                <button
                  onClick={() => handleAdminAction('alarms')}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  <Bell className="w-4 h-4 text-brand-primary" />
                  Open Alarms Center
                </button>
                <button
                  onClick={() => handleAdminAction('settings')}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  <Settings className="w-4 h-4 text-brand-primary" />
                  Open Settings
                </button>
              </div>
            </div>
          )}
          </div>
      </div>
    </header>
  );
}
