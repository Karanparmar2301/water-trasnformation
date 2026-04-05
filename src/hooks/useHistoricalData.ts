import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { fetchReadings } from '../lib/readingsApi';

interface UseHistoricalDataResult {
  loading: boolean;
  error: string | null;
  warning: string | null;
  sourceTable: string | null;
  lastSync: string | null;
}

export function useHistoricalData(timeRangeHours: number = 24): UseHistoricalDataResult {
  const { isRealtime, setHistoricalData } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceTable, setSourceTable] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if (isRealtime) return;

    let isActive = true;

    const fetchHistorical = async () => {
      setLoading(true);
      setError(null);

      try {
        const timeAgo = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();
        const result = await fetchReadings({
          sinceIso: timeAgo,
          limit: 5000,
        });

        if (!isActive) return;

        if (result.error) {
          setError(result.error);
          return;
        }

        let readings = result.readings;

        if (readings.length === 0) {
          const fallbackResult = await fetchReadings({
            source: result.source,
            limit: 5000,
          });

          if (!isActive) return;

          if (!fallbackResult.error) {
            readings = fallbackResult.readings;
          }
        }

        if (result.source) {
          setSourceTable(result.source.table);
        }

        setHistoricalData(readings);
        setLastSync(new Date().toISOString());
      } catch (cause) {
        if (!isActive) return;
        setError(cause instanceof Error ? cause.message : 'Unexpected error while loading historical data.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void fetchHistorical();

    return () => {
      isActive = false;
    };
  }, [isRealtime, timeRangeHours, setHistoricalData]);

  return {
    loading,
    error,
    warning: null,
    sourceTable,
    lastSync,
  };
}
