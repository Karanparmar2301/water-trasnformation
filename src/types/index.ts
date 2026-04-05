export type SensorStatus = 'Normal' | 'Warning' | 'Critical';

export interface SensorConfig {
  id: string;
  name: string;
  unit: string;
  minNormal: number;
  maxNormal: number;
  maxWarning: number;
}

export interface SensorReading {
  id: string;
  sensor_id: string;
  value: number;
  timestamp: string;
}

export interface ProcessedSensorData extends SensorConfig {
  currentValue: number;
  status: SensorStatus;
  trend: 'up' | 'down' | 'stable';
  history: { value: number; timestamp: string }[];
}

export const SENSORS: SensorConfig[] = [
  { id: 's1', name: 'BOD', unit: 'mg/L', minNormal: 0, maxNormal: 10, maxWarning: 30 },
  { id: 's2', name: 'COD', unit: 'mg/L', minNormal: 0, maxNormal: 50, maxWarning: 100 },
  { id: 's3', name: 'pH', unit: 'pH', minNormal: 6.5, maxNormal: 8.5, maxWarning: 9.0 },
  { id: 's4', name: 'TSS', unit: 'mg/L', minNormal: 0, maxNormal: 20, maxWarning: 30 },
  { id: 's5', name: 'TN', unit: 'mg/L', minNormal: 0, maxNormal: 10, maxWarning: 15 },
  { id: 's6', name: 'TP', unit: 'mg/L', minNormal: 0, maxNormal: 1, maxWarning: 2 },
  { id: 's7', name: 'DO (Aeration)', unit: 'mg/L', minNormal: 1.5, maxNormal: 3.0, maxWarning: 4.0 },
  { id: 's8', name: 'MLSS', unit: 'mg/L', minNormal: 2000, maxNormal: 4000, maxWarning: 5000 },
  { id: 's9', name: 'Ammonia', unit: 'mg/L', minNormal: 0, maxNormal: 5, maxWarning: 10 },
  { id: 's10', name: 'Airflow', unit: 'm3/hr', minNormal: 50, maxNormal: 150, maxWarning: 200 },
  { id: 's11', name: 'Flow Rate (In)', unit: 'm³/h', minNormal: 50, maxNormal: 150, maxWarning: 200 },
  { id: 's12', name: 'Flow Rate (Out)', unit: 'm³/h', minNormal: 50, maxNormal: 150, maxWarning: 200 },
  { id: 's13', name: 'Temperature', unit: '°C', minNormal: 15, maxNormal: 30, maxWarning: 35 },
  { id: 's14', name: 'OTE', unit: '%', minNormal: 20, maxNormal: 80, maxWarning: 95 },
  { id: 's15', name: 'Chlorine Dose', unit: 'mg/L', minNormal: 0.2, maxNormal: 1.0, maxWarning: 2.0 },
  { id: 's16', name: 'Sludge Level', unit: 'm', minNormal: 0.5, maxNormal: 2.0, maxWarning: 2.5 },
  { id: 's17', name: 'Power Consumption', unit: 'kW', minNormal: 10, maxNormal: 50, maxWarning: 70 },
  { id: 's18', name: 'SVI', unit: 'mL/g', minNormal: 80, maxNormal: 150, maxWarning: 200 },
  { id: 's19', name: 'Pump 2 Status', unit: 'Hz', minNormal: 40, maxNormal: 50, maxWarning: 60 },
  { id: 's20', name: 'Chlorine Residual', unit: 'mg/L', minNormal: 0.2, maxNormal: 1.0, maxWarning: 2.0 },
];

export function calculateStatus(value: number, config: SensorConfig): SensorStatus {
  if (value > config.maxWarning || value < config.minNormal - (config.maxWarning - config.maxNormal)) return 'Critical';
  if (value > config.maxNormal || value < config.minNormal) return 'Warning';
  return 'Normal';
}
