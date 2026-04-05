import { create } from 'zustand';
import { ProcessedSensorData, SensorReading, SENSORS, calculateStatus } from '../types';

type SensorThresholdUpdate = {
  minNormal?: number;
  maxNormal?: number;
  maxWarning?: number;
};

interface AppState {
  isRealtime: boolean;
  setRealtimeMode: (enabled: boolean) => void;
  toggleMode: () => void;
  historicalHours: number;
  setHistoricalHours: (hours: number) => void;
  activeTab: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  preserveSearchAcrossTabs: boolean;
  setPreserveSearchAcrossTabs: (enabled: boolean) => void;
  notifyOnCritical: boolean;
  notifyOnWarning: boolean;
  setNotifyOnCritical: (enabled: boolean) => void;
  setNotifyOnWarning: (enabled: boolean) => void;
  selectedSensorId: string | null;
  setSelectedSensorId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  sensors: Record<string, ProcessedSensorData>;
  updateSensorThresholds: (sensorId: string, updates: SensorThresholdUpdate) => void;
  resetSensorThresholds: (sensorId: string) => void;
  recentReadings: SensorReading[];
  addReading: (reading: SensorReading) => void;
  setHistoricalData: (readings: SensorReading[]) => void;
}

function buildInitialSensors(
  source?: Record<string, ProcessedSensorData>,
): Record<string, ProcessedSensorData> {
  const initialSensors: Record<string, ProcessedSensorData> = {};

  SENSORS.forEach((sensorConfig) => {
    const previous = source?.[sensorConfig.id];

    initialSensors[sensorConfig.id] = {
      ...sensorConfig,
      minNormal: previous?.minNormal ?? sensorConfig.minNormal,
      maxNormal: previous?.maxNormal ?? sensorConfig.maxNormal,
      maxWarning: previous?.maxWarning ?? sensorConfig.maxWarning,
      currentValue: 0,
      status: 'Normal',
      trend: 'stable',
      history: [],
    };
  });

  return initialSensors;
}

const defaultSensors = buildInitialSensors();

export const useStore = create<AppState>((set) => ({
  isRealtime: true,
  setRealtimeMode: (enabled) => set({ isRealtime: enabled }),
  toggleMode: () => set((state) => ({ isRealtime: !state.isRealtime })),
  historicalHours: 24,
  setHistoricalHours: (hours) => set({ historicalHours: Math.max(1, Math.round(hours)) }),
  activeTab: 'dashboard',
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearSearch: () => set({ searchQuery: '' }),
  preserveSearchAcrossTabs: true,
  setPreserveSearchAcrossTabs: (enabled) => set({ preserveSearchAcrossTabs: enabled }),
  notifyOnCritical: true,
  notifyOnWarning: true,
  setNotifyOnCritical: (enabled) => set({ notifyOnCritical: enabled }),
  setNotifyOnWarning: (enabled) => set({ notifyOnWarning: enabled }),
  selectedSensorId: null,
  setSelectedSensorId: (id) => set({ selectedSensorId: id }),
  setActiveTab: (tab) =>
    set((state) => ({
      activeTab: tab,
      searchQuery: state.preserveSearchAcrossTabs ? state.searchQuery : '',
    })),
  sensors: defaultSensors,

  updateSensorThresholds: (sensorId, updates) =>
    set((state) => {
      const sensor = state.sensors[sensorId];
      if (!sensor) {
        return state;
      }

      const nextMin = Number.isFinite(updates.minNormal) ? Number(updates.minNormal) : sensor.minNormal;
      const nextMaxNormalRaw = Number.isFinite(updates.maxNormal) ? Number(updates.maxNormal) : sensor.maxNormal;
      const nextMaxWarningRaw = Number.isFinite(updates.maxWarning) ? Number(updates.maxWarning) : sensor.maxWarning;

      const maxNormal = Math.max(nextMin, nextMaxNormalRaw);
      const maxWarning = Math.max(maxNormal, nextMaxWarningRaw);

      const updatedSensor: ProcessedSensorData = {
        ...sensor,
        minNormal: nextMin,
        maxNormal,
        maxWarning,
        status: calculateStatus(sensor.currentValue, {
          ...sensor,
          minNormal: nextMin,
          maxNormal,
          maxWarning,
        }),
      };

      return {
        sensors: {
          ...state.sensors,
          [sensorId]: updatedSensor,
        },
      };
    }),

  resetSensorThresholds: (sensorId) =>
    set((state) => {
      const sensor = state.sensors[sensorId];
      const defaultSensor = SENSORS.find((item) => item.id === sensorId);

      if (!sensor || !defaultSensor) {
        return state;
      }

      const updatedSensor: ProcessedSensorData = {
        ...sensor,
        minNormal: defaultSensor.minNormal,
        maxNormal: defaultSensor.maxNormal,
        maxWarning: defaultSensor.maxWarning,
        status: calculateStatus(sensor.currentValue, defaultSensor),
      };

      return {
        sensors: {
          ...state.sensors,
          [sensorId]: updatedSensor,
        },
      };
    }),

  recentReadings: [],
  
  addReading: (reading) => set((state) => {
    const sensor = state.sensors[reading.sensor_id];
    if (!sensor) return state;

    const newHistory = [...sensor.history, { value: reading.value, timestamp: reading.timestamp }].slice(-50);
    const prevValue = sensor.currentValue;
    const trend = reading.value > prevValue ? 'up' : reading.value < prevValue ? 'down' : 'stable';

    return {
      sensors: {
        ...state.sensors,
        [reading.sensor_id]: {
          ...sensor,
          currentValue: reading.value,
          status: calculateStatus(reading.value, sensor),
          trend,
          history: newHistory
        }
      },
      recentReadings: [reading, ...state.recentReadings].slice(0, 50)
    };
  }),

  setHistoricalData: (readings) => set((state) => {
    const newSensors = buildInitialSensors(state.sensors);
    
    // Group readings by sensor
    readings.forEach((r) => {
      if (newSensors[r.sensor_id]) {
        newSensors[r.sensor_id].history.push({ value: r.value, timestamp: r.timestamp });
      }
    });

    // Update current values based on last historical reading
    Object.keys(newSensors).forEach((id) => {
      const history = newSensors[id].history;
      if (history.length > 0) {
        // Sort history by timestamp
        history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const last = history[history.length - 1];
        newSensors[id].currentValue = last.value;
        newSensors[id].status = calculateStatus(last.value, newSensors[id]);
      }
    });

    return {
      sensors: newSensors,
      recentReadings: readings.slice(-50).reverse()
    };
  })
}));
