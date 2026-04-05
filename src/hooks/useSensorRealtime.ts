import { useEffect, useMemo, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, supabaseSchema } from '../lib/supabase';
import { resolveReadingsSource } from '../lib/readingsApi';
import { useStore } from '../store/useStore';
import {
  normalizeSensorToken,
  resolveSensorNameCandidates,
  SENSOR_MODAL_TABLE,
  SENSOR_NAME_COLUMN,
  SENSOR_TIMESTAMP_COLUMNS,
  SENSOR_UNIT_COLUMN,
  SENSOR_VALUE_COLUMN,
  toIsoTimestamp,
  toNumericValue,
} from './sensorQueryUtils';

const LATEST_FETCH_LIMIT = 10000;

export interface SensorRealtimeRecord {
  sensor_name: string;
  value: number;
  unit: string;
  timestamp: string;
  event_time: string;
}

interface UseSensorRealtimeResult {
  sensor: any;
  reading: SensorRealtimeRecord | null;
  loading: boolean;
  error: string | null;
}

function extractRealtimeRecord(
  row: Record<string, unknown>,
  timestampColumns: string[],
  fallbackName: string,
): SensorRealtimeRecord | null {
  const value = toNumericValue(row[SENSOR_VALUE_COLUMN] ?? row.value);
  let timestamp: string | null = null;

  for (const timestampColumn of timestampColumns) {
    timestamp = toIsoTimestamp(row[timestampColumn]);
    if (timestamp) {
      break;
    }
  }

  if (!timestamp) {
    timestamp = toIsoTimestamp(row.event_time ?? row.timestamp ?? row.created_at ?? row.time);
  }

  if (value === null || !timestamp) {
    return null;
  }

  const sensorName = String(row[SENSOR_NAME_COLUMN] ?? row.sensor_name ?? fallbackName);
  const unit = String(row[SENSOR_UNIT_COLUMN] ?? row.unit ?? '');

  return {
    sensor_name: sensorName,
    value,
    unit,
    timestamp,
    event_time: timestamp,
  };
}

export function useSensorRealtime(sensorName: string): UseSensorRealtimeResult {
  const { sensors } = useStore();
  const [reading, setReading] = useState<SensorRealtimeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensor = useMemo(() => {
    if (!sensorName) {
      return null;
    }

    const normalized = sensorName.toLowerCase();
    return Object.values(sensors).find((item) => item.name.toLowerCase() === normalized || item.id === sensorName) || null;
  }, [sensors, sensorName]);

  const activeSensorName = sensor?.name || sensorName;

  const sensorNameCandidates = useMemo(
    () => resolveSensorNameCandidates(activeSensorName),
    [activeSensorName],
  );

  useEffect(() => {
    if (!activeSensorName) {
      setReading(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!supabase) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }

    let isActive = true;
    let channel: RealtimeChannel | null = null;
    let sourceTable = SENSOR_MODAL_TABLE;

    type QueryResult = { data: unknown; error: { message: string } | null };
    const candidateTokens = new Set(sensorNameCandidates.map((name) => normalizeSensorToken(name)));

    const rowMatchesSensor = (row: Record<string, unknown>): boolean => {
      const rawName = row[SENSOR_NAME_COLUMN] ?? row.sensor_name ?? row.name;
      const token = normalizeSensorToken(String(rawName ?? ''));
      return candidateTokens.has(token);
    };

    const fetchLatestReading = async (): Promise<string[]> => {
      const sourceResult = await resolveReadingsSource();
      sourceTable = sourceResult.source?.table || SENSOR_MODAL_TABLE;
      const timestampCandidates = [sourceResult.source?.timestampColumn, ...SENSOR_TIMESTAMP_COLUMNS].filter(
        (column): column is string => Boolean(column),
      );
      const idColumn = sourceResult.source?.idColumn;

      let query = (supabase as any)
        .schema(supabaseSchema)
        .from(sourceTable)
        .select('*');

      if (idColumn) {
        query = query.order(idColumn, { ascending: false });
      }

      const result = (await query.limit(LATEST_FETCH_LIMIT)) as QueryResult;

      if (!isActive) {
        return [];
      }

      if (result.error) {
        setError(`Failed to load sensor data: ${result.error.message}`);
        return timestampCandidates;
      }

      const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
      const latestRow = rows.find((row) => rowMatchesSensor(row));

      if (latestRow) {
        const latest = extractRealtimeRecord(latestRow, timestampCandidates, activeSensorName);
        if (latest) {
          setReading(latest);
        }
      }

      if (timestampCandidates.length === 0) {
        setError('No usable timestamp column found for sensor readings table.');
      }

      return timestampCandidates;
    };

    const setupRealtimeSubscription = (timestampColumns: string[]) => {
      channel = supabase
        .channel(`sensor-modal-${activeSensorName}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: supabaseSchema,
            table: sourceTable,
          },
          (payload) => {
            if (!isActive) {
              return;
            }

            const row = payload.new as Record<string, unknown>;
            if (!rowMatchesSensor(row)) {
              return;
            }

            const nextReading = extractRealtimeRecord(row, timestampColumns, activeSensorName);
            if (!nextReading) {
              return;
            }

            setReading((previous) => {
              if (
                previous &&
                previous.timestamp === nextReading.timestamp &&
                previous.value === nextReading.value
              ) {
                return previous;
              }

              return nextReading;
            });
          },
        )
        .subscribe();
    };

    const initialize = async () => {
      setLoading(true);
      setError(null);

      const timestampColumns = await fetchLatestReading();
      if (isActive) {
        setupRealtimeSubscription(timestampColumns);
      }

      if (isActive) {
        setLoading(false);
      }
    };

    void initialize();

    return () => {
      isActive = false;
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [activeSensorName, sensorNameCandidates]);

  return {
    sensor,
    reading,
    loading,
    error,
  };
}
