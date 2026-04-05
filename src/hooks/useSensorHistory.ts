import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseSchema } from '../lib/supabase';
import { resolveReadingsSource } from '../lib/readingsApi';
import {
  normalizeSensorToken,
  resolveSensorNameCandidates,
  SENSOR_MODAL_TABLE,
  SENSOR_NAME_COLUMN,
  SENSOR_TIMESTAMP_COLUMNS,
  SENSOR_VALUE_COLUMN,
  toIsoTimestamp,
  toNumericValue,
} from './sensorQueryUtils';

type SensorRange = '1h' | '6h' | '24h';
const HISTORY_PAGE_SIZE = 5000;
const HISTORY_MAX_POINTS = 1200;

interface SensorHistoryPoint {
  timestamp: string;
  event_time: string;
  value: number;
}

interface SensorHistoryStats {
  avg: number;
  min: number;
  max: number;
}

interface UseSensorHistoryResult {
  data: SensorHistoryPoint[];
  loading: boolean;
  error: string | null;
  stats: SensorHistoryStats;
}

const DEFAULT_STATS: SensorHistoryStats = { avg: 0, min: 0, max: 0 };

function normalizeRange(range: SensorRange | number): SensorRange {
  if (typeof range === 'number') {
    if (range <= 1) return '1h';
    if (range <= 6) return '6h';
    return '24h';
  }

  return range;
}

function getRangeHours(range: SensorRange): number {
  if (range === '1h') return 1;
  if (range === '6h') return 6;
  return 24;
}

function getMaxPages(range: SensorRange): number {
  if (range === '1h') return 1;
  if (range === '6h') return 3;
  return 6;
}

function extractTimestampFromRow(row: Record<string, unknown>, timestampCandidates: string[]): string | null {
  for (const timestampColumn of timestampCandidates) {
    const parsed = toIsoTimestamp(row[timestampColumn]);
    if (parsed) {
      return parsed;
    }
  }

  return toIsoTimestamp(row.event_time ?? row.timestamp ?? row.created_at ?? row.time);
}

function computeStats(data: SensorHistoryPoint[]): SensorHistoryStats {
  if (data.length === 0) {
    return DEFAULT_STATS;
  }

  const values = data.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    avg: total / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function useSensorHistory(sensorName: string, range: SensorRange | number): UseSensorHistoryResult {
  const [data, setData] = useState<SensorHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeValue = normalizeRange(range);
  const sensorNameCandidates = useMemo(() => resolveSensorNameCandidates(sensorName), [sensorName]);

  useEffect(() => {
    let isActive = true;

    type QueryResult = { data: unknown; error: { message: string } | null };
    const candidateTokens = new Set(sensorNameCandidates.map((name) => normalizeSensorToken(name)));

    const rowMatchesSensor = (row: Record<string, unknown>): boolean => {
      const rawName = row[SENSOR_NAME_COLUMN] ?? row.sensor_name ?? row.name;
      const token = normalizeSensorToken(String(rawName ?? ''));
      return candidateTokens.has(token);
    };

    const loadHistory = async () => {
      if (!sensorName) {
        setData([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (!supabase) {
        setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const sourceResult = await resolveReadingsSource();
      const source = sourceResult.source;

      const table = source?.table || SENSOR_MODAL_TABLE;
      const idColumn = source?.idColumn || null;
      const timestampCandidates = [source?.timestampColumn, ...SENSOR_TIMESTAMP_COLUMNS].filter(
        (column): column is string => Boolean(column),
      );

      if (timestampCandidates.length === 0) {
        if (isActive) {
          setError('No valid timestamp column found for historical data.');
          setLoading(false);
        }
        return;
      }

      const windowStartMs = Date.now() - getRangeHours(rangeValue) * 60 * 60 * 1000;
      const maxPages = getMaxPages(rangeValue);
      const fetchedRows: Record<string, unknown>[] = [];

      if (idColumn) {
        let cursor: number | null = null;

        for (let page = 0; page < maxPages; page += 1) {
          let query = (supabase as any)
            .schema(supabaseSchema)
            .from(table)
            .select('*')
            .order(idColumn, { ascending: false })
            .limit(HISTORY_PAGE_SIZE);

          if (cursor !== null) {
            query = query.lt(idColumn, cursor);
          }

          const result = (await query) as QueryResult;

          if (!isActive) {
            return;
          }

          if (result.error) {
            setError(`Failed to load historical data: ${result.error.message}`);
            setLoading(false);
            return;
          }

          const pageRows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
          if (pageRows.length === 0) {
            break;
          }

          fetchedRows.push(...pageRows);

          const lastId = toNumericValue(pageRows[pageRows.length - 1][idColumn]);
          if (lastId === null) {
            break;
          }
          cursor = lastId;

          const oldestTimestamp = extractTimestampFromRow(pageRows[pageRows.length - 1], timestampCandidates);
          if (oldestTimestamp) {
            const oldestMs = new Date(oldestTimestamp).getTime();
            if (Number.isFinite(oldestMs) && oldestMs <= windowStartMs) {
              break;
            }
          }
        }
      } else {
        const result = (await (supabase as any)
          .schema(supabaseSchema)
          .from(table)
          .select('*')
          .limit(HISTORY_PAGE_SIZE * maxPages)) as QueryResult;

        if (!isActive) {
          return;
        }

        if (result.error) {
          setError(`Failed to load historical data: ${result.error.message}`);
          setLoading(false);
          return;
        }

        fetchedRows.push(...(Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : []));
      }

      const points = fetchedRows
        .filter((row) => rowMatchesSensor(row))
        .map((row) => {
          const value = toNumericValue(row[SENSOR_VALUE_COLUMN] ?? row.value);
          const timestamp = extractTimestampFromRow(row, timestampCandidates);

          if (value === null || !timestamp) {
            return null;
          }

          const timestampMs = new Date(timestamp).getTime();
          if (!Number.isFinite(timestampMs) || timestampMs < windowStartMs) {
            return null;
          }

          return {
            value,
            timestamp,
            event_time: timestamp,
          };
        })
        .filter((point): point is SensorHistoryPoint => point !== null)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const deduped = new Map<string, SensorHistoryPoint>();
      points.forEach((point) => {
        deduped.set(point.timestamp, point);
      });

      const normalizedPoints = [...deduped.values()];
      const cappedPoints =
        normalizedPoints.length > HISTORY_MAX_POINTS
          ? normalizedPoints.slice(-HISTORY_MAX_POINTS)
          : normalizedPoints;

      if (isActive) {
        setData(cappedPoints);
        setLoading(false);
      }
    };

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [sensorName, rangeValue, sensorNameCandidates]);

  return {
    data,
    loading,
    error,
    stats: computeStats(data),
  };
}
