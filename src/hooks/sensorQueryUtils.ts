export const SENSOR_MODAL_TABLE = (
  import.meta.env.VITE_SUPABASE_SENSOR_READINGS_TABLE ||
  import.meta.env.VITE_SUPABASE_READINGS_TABLE ||
  'sensor_readings'
).trim();

export const SENSOR_NAME_COLUMN = (import.meta.env.VITE_SUPABASE_SENSOR_NAME_COLUMN || 'sensor_name').trim();
export const SENSOR_VALUE_COLUMN = (import.meta.env.VITE_SUPABASE_SENSOR_VALUE_COLUMN || 'value').trim();
export const SENSOR_UNIT_COLUMN = (import.meta.env.VITE_SUPABASE_SENSOR_UNIT_COLUMN || 'unit').trim();

const configuredTimestampColumn = (import.meta.env.VITE_SUPABASE_SENSOR_TIMESTAMP_COLUMN || '').trim();

export const SENSOR_TIMESTAMP_COLUMNS = [
  configuredTimestampColumn,
  'event_time',
  'timestamp',
  'created_at',
  'recorded_at',
  'time',
]
  .filter((column): column is string => Boolean(column))
  .filter((column, index, columns) => columns.indexOf(column) === index);

const SENSOR_NAME_ALIASES: Record<string, string[]> = {
  bod: ['BOD'],
  cod: ['COD'],
  ph: ['pH', 'PH'],
  tss: ['TSS'],
  tn: ['TN', 'Total Nitrogen'],
  tp: ['TP', 'Total Phosphorus'],
  doaeration: ['DO', 'DO (Aeration)', 'Dissolved Oxygen'],
  do: ['DO (Aeration)', 'Dissolved Oxygen'],
  mlss: ['MLSS'],
  ammonia: ['NH3'],
  airflow: ['Air Flow'],
  flowratein: ['Flow In', 'Influent Flow', 'FlowRateIn'],
  flowin: ['Flow Rate (In)', 'Influent Flow', 'FlowRateIn'],
  flowrateout: ['Flow Out', 'Effluent Flow', 'FlowRateOut'],
  flowout: ['Flow Rate (Out)', 'Effluent Flow', 'FlowRateOut'],
  temperature: ['Temp'],
  ote: ['OTE'],
  chlorinedose: ['Chlorine Dose'],
  sludgelevel: ['Sludge Level'],
  powerconsumption: ['Power', 'Energy'],
  svi: ['SVI'],
  pumpstatus: ['Pump 2 Status', 'Pump2Status', 'Pump Status'],
  pump2status: ['Pump Status', 'Pump2Status'],
  chlorineresidual: ['Residual Chlorine'],
};

export function normalizeSensorToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function resolveSensorNameCandidates(sensorName: string): string[] {
  if (!sensorName) {
    return [];
  }

  const normalized = normalizeSensorToken(sensorName);
  const aliases = SENSOR_NAME_ALIASES[normalized] || [];

  return [sensorName, ...aliases].filter((name, index, values) => {
    const normalizedName = normalizeSensorToken(name);
    return values.findIndex((candidate) => normalizeSensorToken(candidate) === normalizedName) === index;
  });
}

export function toNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

export function isMissingColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('column') && normalized.includes('does not exist');
}