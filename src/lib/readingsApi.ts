import { RealtimeChannel } from '@supabase/supabase-js';
import { SENSORS, SensorReading } from '../types';
import { fromSupabaseTable, sanitizeSupabaseIdentifier, supabase, supabaseRealtimeSchema } from './supabase';

interface ReadingsSource {
  table: string;
  timestampColumn: string | null;
  idColumn: string | null;
}

interface ResolveSourceResult {
  source?: ReadingsSource;
  error?: string;
}

interface FetchReadingsOptions {
  source?: ReadingsSource;
  sinceIso?: string;
  limit?: number;
}

interface FetchReadingsResult {
  source?: ReadingsSource;
  readings: SensorReading[];
  error?: string;
}

interface FetchReadingsWindowOptions {
  source?: ReadingsSource;
  windowStartIso: string;
  windowEndIso: string;
  limit?: number;
}

interface FetchReadingsByIdRangeOptions {
  source?: ReadingsSource;
  rangeStartInclusive: number;
  rangeEndExclusive: number;
  limit?: number;
}

interface FetchLatestReadingsAnchorOptions {
  source?: ReadingsSource;
}

interface FetchReadingsAnchorResult {
  source?: ReadingsSource;
  anchorRecordId?: number;
  anchorTimestampIso?: string;
  error?: string;
}

interface SubscribeOptions {
  source: ReadingsSource;
  onReading: (reading: SensorReading) => void;
  onError?: (message: string) => void;
}

const DEFAULT_TABLE_CANDIDATES = [
  'STP Sensors 6 months Data',
  'readings',
  'sensor_readings',
  'sensor_data',
  'telemetry',
  'measurements',
  'historical_data',
];

const TIMESTAMP_COLUMNS = ['timestamp', 'event_time', 'ingestion_time', 'recorded_at', 'created_at', 'datetime', 'time', 'ts'];
const SENSOR_COLUMNS = ['sensor_id', 'sensorid', 'sensor', 'sensor_name', 'parameter', 'metric', 'tag', 'name'];
const VALUE_COLUMNS = ['value', 'reading', 'reading_value', 'sensor_value', 'measurement', 'metric_value', 'val'];
const ID_COLUMNS = ['Record_id', 'record_id', 'id', 'reading_id', 'uuid', 'event_id'];

const SENSOR_ALIAS_MAP: Record<string, string[]> = {
  s1: ['bod'],
  s2: ['cod'],
  s3: ['ph'],
  s4: ['tss'],
  s5: ['tn', 'totalnitrogen'],
  s6: ['tp', 'totalphosphorus', 'phosphorus'],
  s7: ['do', 'dissolvedoxygen', 'doaeration'],
  s8: ['mlss'],
  s9: ['ammonia', 'nh3'],
  s10: ['airflow', 'nitrate', 'no3'],
  s11: ['flowratein', 'influentflow', 'flowin', 'rasflow'],
  s12: ['flowrateout', 'effluentflow', 'flowout', 'wasflow'],
  s13: ['temperature', 'temp'],
  s14: ['ote', 'turbidity'],
  s15: ['chlorinedose', 'orp'],
  s16: ['sludgelevel'],
  s17: ['powerconsumption', 'power', 'energy'],
  s18: ['svi', 'pump1status', 'pump1'],
  s19: ['pump2status', 'pump2', 'vibration'],
  s20: ['chlorineresidual', 'chlorine', 'residualchlorine'],
};

let cachedSource: ReadingsSource | null = null;

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildSensorLookup(): Map<string, string> {
  const lookup = new Map<string, string>();

  SENSORS.forEach((sensor) => {
    lookup.set(normalizeToken(sensor.id), sensor.id);
    lookup.set(normalizeToken(sensor.name), sensor.id);

    const aliases = SENSOR_ALIAS_MAP[sensor.id] || [];
    aliases.forEach((alias) => {
      lookup.set(normalizeToken(alias), sensor.id);
    });
  });

  return lookup;
}

const sensorLookup = buildSensorLookup();

function parseConfiguredTables(): string[] {
  const fromSingle = sanitizeSupabaseIdentifier(import.meta.env.VITE_SUPABASE_READINGS_TABLE || '');
  const fromList = (import.meta.env.VITE_SUPABASE_READINGS_TABLES || '')
    .split(',')
    .map((item: string) => sanitizeSupabaseIdentifier(item))
    .filter((item: string) => item.length > 0);

  const ordered = [fromSingle, ...fromList, ...DEFAULT_TABLE_CANDIDATES].filter((item) => item.length > 0);
  const deduped: string[] = [];

  ordered.forEach((item) => {
    if (!deduped.includes(item)) {
      deduped.push(item);
    }
  });

  return deduped;
}

function isMissingTableError(message: string): boolean {
  return message.toLowerCase().includes('could not find the table');
}

function isMissingColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('column') && normalized.includes('does not exist');
}

function isStatementTimeoutError(message: string): boolean {
  return message.toLowerCase().includes('statement timeout');
}

function toNumber(value: unknown): number | null {
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

function toIsoTimestamp(value: unknown): string {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function resolveSensorId(rawValue: unknown): string | null {
  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
    return null;
  }

  const rawText = String(rawValue).trim();
  if (!rawText) {
    return null;
  }

  const exact = SENSORS.find((sensor) => sensor.id === rawText);
  if (exact) {
    return exact.id;
  }

  return sensorLookup.get(normalizeToken(rawText)) || null;
}

function buildKeyMap(row: Record<string, unknown>): Map<string, string> {
  const keyMap = new Map<string, string>();
  Object.keys(row).forEach((key) => {
    keyMap.set(normalizeToken(key), key);
  });
  return keyMap;
}

function getColumnValue(row: Record<string, unknown>, candidates: string[]): unknown {
  const keyMap = buildKeyMap(row);

  for (const candidate of candidates) {
    const exact = row[candidate];
    if (exact !== undefined) {
      return exact;
    }

    const mappedKey = keyMap.get(normalizeToken(candidate));
    if (mappedKey) {
      return row[mappedKey];
    }
  }

  return undefined;
}

function inferTimestampColumn(sampleRow: Record<string, unknown> | undefined): string | null {
  if (!sampleRow) {
    return null;
  }

  const keyMap = buildKeyMap(sampleRow);

  for (const column of TIMESTAMP_COLUMNS) {
    if (sampleRow[column] !== undefined) {
      return column;
    }

    const mappedKey = keyMap.get(normalizeToken(column));
    if (mappedKey) {
      return mappedKey;
    }
  }

  return null;
}

function inferIdColumn(sampleRow: Record<string, unknown> | undefined): string | null {
  if (!sampleRow) {
    return null;
  }

  const keyMap = buildKeyMap(sampleRow);

  for (const column of ID_COLUMNS) {
    if (sampleRow[column] !== undefined) {
      return column;
    }

    const mappedKey = keyMap.get(normalizeToken(column));
    if (mappedKey) {
      return mappedKey;
    }
  }

  return null;
}

function getTimestampValue(row: Record<string, unknown>, preferredTimestampColumn: string | null): unknown {
  if (preferredTimestampColumn && row[preferredTimestampColumn] !== undefined) {
    return row[preferredTimestampColumn];
  }

  return getColumnValue(row, TIMESTAMP_COLUMNS);
}

function getRowBaseId(row: Record<string, unknown>, rowIndex: number): string {
  const value =
    row.id ??
    row.Record_id ??
    row.reading_id ??
    row.uuid ??
    row.record_id ??
    row.event_id ??
    rowIndex;

  return String(value);
}

function extractDirectReading(
  row: Record<string, unknown>,
  sourceTable: string,
  preferredTimestampColumn: string | null,
  rowIndex: number,
): SensorReading | null {
  const sensorValue = getColumnValue(row, SENSOR_COLUMNS);
  const readingValue = getColumnValue(row, VALUE_COLUMNS);

  const sensorId = resolveSensorId(sensorValue);
  const numericValue = toNumber(readingValue);

  if (!sensorId || numericValue === null) {
    return null;
  }

  const timestamp = toIsoTimestamp(getTimestampValue(row, preferredTimestampColumn));

  return {
    id: `${sourceTable}-${getRowBaseId(row, rowIndex)}-${sensorId}`,
    sensor_id: sensorId,
    value: numericValue,
    timestamp,
  };
}

function extractWideReadings(
  row: Record<string, unknown>,
  sourceTable: string,
  preferredTimestampColumn: string | null,
  rowIndex: number,
): SensorReading[] {
  const rowKeyMap = buildKeyMap(row);
  const readings: SensorReading[] = [];
  const timestamp = toIsoTimestamp(getTimestampValue(row, preferredTimestampColumn));
  const rowId = getRowBaseId(row, rowIndex);

  SENSORS.forEach((sensor) => {
    const tokens = [normalizeToken(sensor.id), normalizeToken(sensor.name), ...(SENSOR_ALIAS_MAP[sensor.id] || []).map(normalizeToken)];

    for (const token of tokens) {
      const rowKey = rowKeyMap.get(token);
      if (!rowKey) {
        continue;
      }

      const numericValue = toNumber(row[rowKey]);
      if (numericValue === null) {
        continue;
      }

      readings.push({
        id: `${sourceTable}-${rowId}-${sensor.id}`,
        sensor_id: sensor.id,
        value: numericValue,
        timestamp,
      });
      return;
    }
  });

  return readings;
}

function normalizeRows(rows: Record<string, unknown>[], source: ReadingsSource): SensorReading[] {
  const normalized: SensorReading[] = [];

  rows.forEach((row, rowIndex) => {
    const direct = extractDirectReading(row, source.table, source.timestampColumn, rowIndex);
    if (direct) {
      normalized.push(direct);
      return;
    }

    const wide = extractWideReadings(row, source.table, source.timestampColumn, rowIndex);
    normalized.push(...wide);
  });

  return normalized;
}

export async function resolveReadingsSource(forceRefresh = false): Promise<ResolveSourceResult> {
  if (!supabase) {
    return {
      error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  if (cachedSource && !forceRefresh) {
    return { source: cachedSource };
  }

  const candidates = parseConfiguredTables();

  for (const table of candidates) {
    const probeQuery = fromSupabaseTable(table);
    if (!probeQuery) {
      continue;
    }

    const probeResult = await probeQuery.select('*').limit(1);

    if (probeResult.error) {
      if (isMissingTableError(probeResult.error.message)) {
        continue;
      }

      return {
        error: `Unable to access Supabase table "${table}": ${probeResult.error.message}`,
      };
    }

    const rows = Array.isArray(probeResult.data) ? (probeResult.data as Record<string, unknown>[]) : [];
    const source: ReadingsSource = {
      table,
      timestampColumn: inferTimestampColumn(rows[0]),
      idColumn: inferIdColumn(rows[0]),
    };

    cachedSource = source;
    return { source };
  }

  return {
    error:
      'No accessible readings table was found. Set VITE_SUPABASE_READINGS_TABLE (or VITE_SUPABASE_READINGS_TABLES) to your actual table name and ensure anon read policy exists.',
  };
}

function sortByTimestamp(readings: SensorReading[]): SensorReading[] {
  return [...readings].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return aTime - bTime;
  });
}

export async function fetchReadings(options: FetchReadingsOptions = {}): Promise<FetchReadingsResult> {
  if (!supabase) {
    return {
      readings: [],
      error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  const sourceResult = options.source ? { source: options.source } : await resolveReadingsSource();
  if (!sourceResult.source) {
    return {
      readings: [],
      error: sourceResult.error || 'Unable to resolve readings source.',
    };
  }

  const source = sourceResult.source;
  const baseQuery = fromSupabaseTable(source.table);
  if (!baseQuery) {
    return {
      source,
      readings: [],
      error: `Invalid readings table configuration for "${source.table}".`,
    };
  }

  let query = baseQuery.select('*');
  const hasSinceIso = Boolean(options.sinceIso);
  const requestedLimit = options.limit && options.limit > 0 ? options.limit : 0;
  let queryLimit = requestedLimit;

  if (hasSinceIso && source.idColumn) {
    query = query.order(source.idColumn, { ascending: false });
    if (queryLimit < 10000) {
      queryLimit = 10000;
    }
  } else if (source.timestampColumn && hasSinceIso) {
    query = query.gte(source.timestampColumn, options.sinceIso as string);
    query = query.order(source.timestampColumn, { ascending: true });
  } else if (source.idColumn) {
    query = query.order(source.idColumn, { ascending: false });
  } else if (source.timestampColumn) {
    query = query.order(source.timestampColumn, { ascending: false });
  }

  if (queryLimit > 0) {
    query = query.limit(queryLimit);
  }

  const result = await query;

  if (result.error) {
    if (isStatementTimeoutError(result.error.message) && source.idColumn) {
      const fallbackBaseQuery = fromSupabaseTable(source.table);
      if (!fallbackBaseQuery) {
        return {
          source,
          readings: [],
          error: `Invalid readings table configuration for "${source.table}".`,
        };
      }

      let fallbackQuery = fallbackBaseQuery.select('*').order(source.idColumn, { ascending: false });

      if (options.limit && options.limit > 0) {
        fallbackQuery = fallbackQuery.limit(options.limit);
      }

      const fallbackResult = await fallbackQuery;
      if (!fallbackResult.error) {
        const fallbackRows = Array.isArray(fallbackResult.data)
          ? (fallbackResult.data as Record<string, unknown>[])
          : [];
        let fallbackReadings = normalizeRows(fallbackRows, source);

        if (options.sinceIso) {
          const since = new Date(options.sinceIso).getTime();
          fallbackReadings = fallbackReadings.filter(
            (reading) => new Date(reading.timestamp).getTime() >= since,
          );
        }

        fallbackReadings = sortByTimestamp(fallbackReadings);

        if (options.limit && options.limit > 0 && fallbackReadings.length > options.limit) {
          fallbackReadings = fallbackReadings.slice(-options.limit);
        }

        return {
          source,
          readings: fallbackReadings,
        };
      }
    }

    if (source.timestampColumn && isMissingColumnError(result.error.message)) {
      const fallbackSource: ReadingsSource = {
        table: source.table,
        timestampColumn: null,
        idColumn: source.idColumn,
      };
      cachedSource = fallbackSource;
      return fetchReadings({ ...options, source: fallbackSource });
    }

    return {
      source,
      readings: [],
      error: `Failed to fetch readings from "${source.table}": ${result.error.message}`,
    };
  }

  const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
  let readings = normalizeRows(rows, source);

  if (options.sinceIso) {
    const since = new Date(options.sinceIso).getTime();
    readings = readings.filter((reading) => new Date(reading.timestamp).getTime() >= since);
  }

  readings = sortByTimestamp(readings);

  if (options.limit && options.limit > 0 && readings.length > options.limit) {
    readings = readings.slice(-options.limit);
  }

  return {
    source,
    readings,
  };
}

export async function fetchReadingsWindow(options: FetchReadingsWindowOptions): Promise<FetchReadingsResult> {
  if (!supabase) {
    return {
      readings: [],
      error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  const sourceResult = options.source ? { source: options.source } : await resolveReadingsSource();
  if (!sourceResult.source) {
    return {
      readings: [],
      error: sourceResult.error || 'Unable to resolve readings source.',
    };
  }

  const source = sourceResult.source;

  if (!source.timestampColumn) {
    return {
      source,
      readings: [],
      error: `Playback mode requires a timestamp column, but none was found for "${source.table}".`,
    };
  }

  const windowBaseQuery = fromSupabaseTable(source.table);
  if (!windowBaseQuery) {
    return {
      source,
      readings: [],
      error: `Invalid readings table configuration for "${source.table}".`,
    };
  }

  let query = windowBaseQuery
    .select('*')
    .gte(source.timestampColumn, options.windowStartIso)
    .lt(source.timestampColumn, options.windowEndIso)
    .order(source.timestampColumn, { ascending: true });

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const result = await query;

  if (result.error) {
    return {
      source,
      readings: [],
      error: `Failed to fetch playback window from "${source.table}": ${result.error.message}`,
    };
  }

  const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
  const readings = sortByTimestamp(normalizeRows(rows, source));

  return {
    source,
    readings,
  };
}

export async function fetchReadingsByIdRange(options: FetchReadingsByIdRangeOptions): Promise<FetchReadingsResult> {
  if (!supabase) {
    return {
      readings: [],
      error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  const sourceResult = options.source ? { source: options.source } : await resolveReadingsSource();
  if (!sourceResult.source) {
    return {
      readings: [],
      error: sourceResult.error || 'Unable to resolve readings source.',
    };
  }

  const source = sourceResult.source;

  if (!source.idColumn) {
    return {
      source,
      readings: [],
      error: `ID-range mode requires an id column, but none was found for "${source.table}".`,
    };
  }

  const idRangeBaseQuery = fromSupabaseTable(source.table);
  if (!idRangeBaseQuery) {
    return {
      source,
      readings: [],
      error: `Invalid readings table configuration for "${source.table}".`,
    };
  }

  let query = idRangeBaseQuery
    .select('*')
    .gte(source.idColumn, options.rangeStartInclusive)
    .lt(source.idColumn, options.rangeEndExclusive)
    .order(source.idColumn, { ascending: true });

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const result = await query;

  if (result.error) {
    return {
      source,
      readings: [],
      error: `Failed to fetch ID range from "${source.table}": ${result.error.message}`,
    };
  }

  const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
  const readings = sortByTimestamp(normalizeRows(rows, source));

  return {
    source,
    readings,
  };
}

export async function fetchLatestReadingsAnchor(
  options: FetchLatestReadingsAnchorOptions = {},
): Promise<FetchReadingsAnchorResult> {
  if (!supabase) {
    return {
      error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  const sourceResult = options.source ? { source: options.source } : await resolveReadingsSource();
  if (!sourceResult.source) {
    return {
      error: sourceResult.error || 'Unable to resolve readings source.',
    };
  }

  const source = sourceResult.source;

  if (!source.idColumn || !source.timestampColumn) {
    return {
      source,
      error: `Playback anchor requires both id and timestamp columns for "${source.table}".`,
    };
  }

  const columns = `${source.idColumn},${source.timestampColumn}`;
  const anchorBaseQuery = fromSupabaseTable(source.table);
  if (!anchorBaseQuery) {
    return {
      source,
      error: `Invalid readings table configuration for "${source.table}".`,
    };
  }

  const result = await anchorBaseQuery.select(columns).order(source.idColumn, { ascending: false }).limit(1);

  if (result.error) {
    return {
      source,
      error: `Failed to fetch playback anchor from "${source.table}": ${result.error.message}`,
    };
  }

  const rows = Array.isArray(result.data) ? (result.data as unknown[]) : [];
  const row = rows[0];

  if (!row || typeof row !== 'object') {
    return {
      source,
      error: `No rows found in "${source.table}" for playback anchor.`,
    };
  }

  const rowRecord = row as Record<string, unknown>;

  const recordId = toNumber(rowRecord[source.idColumn]);
  if (recordId === null) {
    return {
      source,
      error: `Unable to parse record id from column "${source.idColumn}" in "${source.table}".`,
    };
  }

  const timestampRaw = rowRecord[source.timestampColumn];
  const timestampDate = new Date(String(timestampRaw));
  if (Number.isNaN(timestampDate.getTime())) {
    return {
      source,
      error: `Unable to parse timestamp from column "${source.timestampColumn}" in "${source.table}".`,
    };
  }

  return {
    source,
    anchorRecordId: recordId,
    anchorTimestampIso: timestampDate.toISOString(),
  };
}

export async function fetchEarliestReadingsAnchor(
  options: FetchLatestReadingsAnchorOptions = {},
): Promise<FetchReadingsAnchorResult> {
  if (!supabase) {
    return {
      error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  const sourceResult = options.source ? { source: options.source } : await resolveReadingsSource();
  if (!sourceResult.source) {
    return {
      error: sourceResult.error || 'Unable to resolve readings source.',
    };
  }

  const source = sourceResult.source;

  if (!source.idColumn || !source.timestampColumn) {
    return {
      source,
      error: `Playback anchor requires both id and timestamp columns for "${source.table}".`,
    };
  }

  const columns = `${source.idColumn},${source.timestampColumn}`;
  const earliestAnchorBaseQuery = fromSupabaseTable(source.table);
  if (!earliestAnchorBaseQuery) {
    return {
      source,
      error: `Invalid readings table configuration for "${source.table}".`,
    };
  }

  const result = await earliestAnchorBaseQuery.select(columns).order(source.idColumn, { ascending: true }).limit(1);

  if (result.error) {
    return {
      source,
      error: `Failed to fetch earliest playback anchor from "${source.table}": ${result.error.message}`,
    };
  }

  const rows = Array.isArray(result.data) ? (result.data as unknown[]) : [];
  const row = rows[0];

  if (!row || typeof row !== 'object') {
    return {
      source,
      error: `No rows found in "${source.table}" for earliest playback anchor.`,
    };
  }

  const rowRecord = row as Record<string, unknown>;

  const recordId = toNumber(rowRecord[source.idColumn]);
  if (recordId === null) {
    return {
      source,
      error: `Unable to parse record id from column "${source.idColumn}" in "${source.table}".`,
    };
  }

  const timestampRaw = rowRecord[source.timestampColumn];
  const timestampDate = new Date(String(timestampRaw));
  if (Number.isNaN(timestampDate.getTime())) {
    return {
      source,
      error: `Unable to parse timestamp from column "${source.timestampColumn}" in "${source.table}".`,
    };
  }

  return {
    source,
    anchorRecordId: recordId,
    anchorTimestampIso: timestampDate.toISOString(),
  };
}

export function subscribeToReadings(options: SubscribeOptions): RealtimeChannel | null {
  if (!supabase) {
    return null;
  }

  const channel = supabase
    .channel(`readings-${options.source.table}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: supabaseRealtimeSchema,
        table: options.source.table,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        const direct = extractDirectReading(row, options.source.table, options.source.timestampColumn, 0);

        if (direct) {
          options.onReading(direct);
          return;
        }

        const wide = extractWideReadings(row, options.source.table, options.source.timestampColumn, 0);
        wide.forEach((reading) => options.onReading(reading));
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (options.onError) {
          options.onError(`Realtime subscription failed for "${options.source.table}".`);
        }
      }
    });

  return channel;
}

export function unsubscribeFromReadings(channel: RealtimeChannel | null): void {
  if (supabase && channel) {
    supabase.removeChannel(channel);
  }
}
