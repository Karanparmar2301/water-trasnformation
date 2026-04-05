import { useEffect, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useStore } from '../store/useStore';
import {
  fetchReadings,
  fetchEarliestReadingsAnchor,
  fetchReadingsByIdRange,
  fetchLatestReadingsAnchor,
  resolveReadingsSource,
  subscribeToReadings,
  unsubscribeFromReadings,
} from '../lib/readingsApi';

const POLLING_FALLBACK_MS = 5000;
const PLAYBACK_ENABLED = (import.meta.env.VITE_PLAYBACK_ENABLED || 'true').toLowerCase() === 'true';
const PLAYBACK_START_TIMESTAMP = (import.meta.env.VITE_PLAYBACK_START_TIMESTAMP || '2025-09-01T00:00:00Z').trim();
const PLAYBACK_STEP_MINUTES = Math.max(1, Number(import.meta.env.VITE_PLAYBACK_STEP_MINUTES || '1'));
const PLAYBACK_TICK_MS = Math.max(1000, Number(import.meta.env.VITE_PLAYBACK_TICK_MS || '60000'));
const PLAYBACK_WINDOW_LIMIT = Math.max(20, Number(import.meta.env.VITE_PLAYBACK_WINDOW_LIMIT || '200'));
const PLAYBACK_ROWS_PER_MINUTE = Math.max(1, Number(import.meta.env.VITE_PLAYBACK_ROWS_PER_MINUTE || '20'));
const PLAYBACK_PADDING_MULTIPLIER = Math.max(1, Number(import.meta.env.VITE_PLAYBACK_PADDING_MULTIPLIER || '2'));

function extractRecordIdFromReadingId(readingId: string): number | null {
  const match = readingId.match(/-(\d+)-s\d+$/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

interface UseRealtimeSensorsResult {
  loading: boolean;
  error: string | null;
  warning: string | null;
  sourceTable: string | null;
  lastSync: string | null;
}

export function useRealtimeSensors(): UseRealtimeSensorsResult {
  const { isRealtime, addReading, setHistoricalData } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sourceTable, setSourceTable] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if (!isRealtime) return;

    let isActive = true;
    let channel: RealtimeChannel | null = null;
    let pollingInterval: number | null = null;
    let playbackStepInFlight = false;

    const clearPolling = () => {
      if (pollingInterval !== null) {
        window.clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    const setupRealtime = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);

      try {
        const sourceResult = await resolveReadingsSource();
        if (!isActive) return;

        if (!sourceResult.source) {
          setError(sourceResult.error || 'Unable to resolve live readings source.');
          return;
        }

        setSourceTable(sourceResult.source.table);

        const source = sourceResult.source;

        if (PLAYBACK_ENABLED) {
          const startDate = new Date(PLAYBACK_START_TIMESTAMP);
          if (Number.isNaN(startDate.getTime())) {
            setError(`Invalid playback start timestamp: ${PLAYBACK_START_TIMESTAMP}`);
            return;
          }

          const anchorResult = await fetchLatestReadingsAnchor({ source });
          if (!isActive) return;

          if (anchorResult.error || !anchorResult.anchorRecordId || !anchorResult.anchorTimestampIso) {
            setError(anchorResult.error || 'Unable to resolve playback anchor from Supabase.');
            return;
          }

          const earliestAnchorResult = await fetchEarliestReadingsAnchor({ source });
          if (!isActive) return;

          if (
            earliestAnchorResult.error ||
            !earliestAnchorResult.anchorRecordId ||
            !earliestAnchorResult.anchorTimestampIso
          ) {
            setError(earliestAnchorResult.error || 'Unable to resolve earliest playback anchor from Supabase.');
            return;
          }

          const configuredStartMs = startDate.getTime();
          const earliestMs = new Date(earliestAnchorResult.anchorTimestampIso).getTime();
          const startMs = Math.max(configuredStartMs, earliestMs);
          const latestMs = new Date(anchorResult.anchorTimestampIso).getTime();
          if (startMs > latestMs) {
            setError(`Playback start ${PLAYBACK_START_TIMESTAMP} is later than latest available data.`);
            return;
          }

          const playbackStepMs = PLAYBACK_STEP_MINUTES * 60 * 1000;
          const minutesDelta = Math.floor((latestMs - startMs) / 60000);
          let estimatedRecordIdCursor = Math.max(
            1,
            Math.floor(anchorResult.anchorRecordId - minutesDelta * PLAYBACK_ROWS_PER_MINUTE),
          );
          let playbackStepIndex = 0;
          const idPadding = PLAYBACK_ROWS_PER_MINUTE * PLAYBACK_PADDING_MULTIPLIER;

          if (configuredStartMs < earliestMs) {
            setWarning(
              `Playback start ${new Date(configuredStartMs).toLocaleString()} is earlier than available data. Starting from ${new Date(earliestMs).toLocaleString()} instead.`,
            );
          }

          const filterReadingsForWindow = (readings: Parameters<typeof setHistoricalData>[0], windowStartMs: number, windowEndMs: number) => {
            return readings.filter((reading) => {
              const timestampMs = new Date(reading.timestamp).getTime();
              return Number.isFinite(timestampMs) && timestampMs >= windowStartMs && timestampMs < windowEndMs;
            });
          };

          const runPlaybackStep = async (replaceStore: boolean) => {
            if (playbackStepInFlight) {
              return;
            }

            playbackStepInFlight = true;
            const stepStartMs = startMs + playbackStepIndex * playbackStepMs;
            const stepEndMs = stepStartMs + playbackStepMs;
            const stepStart = new Date(stepStartMs);
            const stepEnd = new Date(stepEndMs);
            const primaryRangeStart = Math.max(1, estimatedRecordIdCursor);
            const primaryRangeEnd = primaryRangeStart + PLAYBACK_ROWS_PER_MINUTE;

            try {
              const windowResult = await fetchReadingsByIdRange({
                source,
                rangeStartInclusive: primaryRangeStart,
                rangeEndExclusive: primaryRangeEnd,
                limit: PLAYBACK_WINDOW_LIMIT,
              });

              if (!isActive) return;

              if (windowResult.error) {
                setError(windowResult.error);
                return;
              }

              let minuteReadings = filterReadingsForWindow(windowResult.readings, stepStartMs, stepEndMs);

              if (minuteReadings.length === 0) {
                const expandedResult = await fetchReadingsByIdRange({
                  source,
                  rangeStartInclusive: Math.max(1, primaryRangeStart - idPadding),
                  rangeEndExclusive: primaryRangeEnd + idPadding,
                  limit: PLAYBACK_WINDOW_LIMIT * 3,
                });

                if (!isActive) return;

                if (!expandedResult.error) {
                  minuteReadings = filterReadingsForWindow(expandedResult.readings, stepStartMs, stepEndMs);
                }
              }

              if (replaceStore) {
                setHistoricalData(minuteReadings);
              } else {
                minuteReadings.forEach((reading) => addReading(reading));
              }

              const recordIds = minuteReadings
                .map((reading) => extractRecordIdFromReadingId(reading.id))
                .filter((value): value is number => value !== null);

              if (recordIds.length > 0) {
                estimatedRecordIdCursor = Math.max(...recordIds) + 1;
              } else {
                estimatedRecordIdCursor += PLAYBACK_ROWS_PER_MINUTE;
              }

              playbackStepIndex += 1;

              setWarning(
                `Playback simulation active. Window ${stepStart.toLocaleString()} to ${stepEnd.toLocaleString()} loaded ${minuteReadings.length} rows, advancing every ${Math.round(PLAYBACK_TICK_MS / 1000)} seconds.`,
              );
              setLastSync(new Date().toISOString());
            } finally {
              playbackStepInFlight = false;
            }
          };

          await runPlaybackStep(true);
          if (!isActive) return;

          pollingInterval = window.setInterval(() => {
            void runPlaybackStep(false);
          }, PLAYBACK_TICK_MS);

          return;
        }

        const refreshLatestSnapshot = async () => {
          const snapshotResult = await fetchReadings({
            source,
            limit: 2000,
          });

          if (!isActive) return;

          if (snapshotResult.error) {
            setWarning(`Polling refresh warning: ${snapshotResult.error}`);
            return;
          }

          setHistoricalData(snapshotResult.readings);
          setLastSync(new Date().toISOString());
        };

        const startPollingFallback = (reason: string) => {
          if (pollingInterval !== null) {
            return;
          }

          setWarning(`${reason} Using 5-second polling fallback.`);
          pollingInterval = window.setInterval(() => {
            void refreshLatestSnapshot();
          }, POLLING_FALLBACK_MS);
        };

        const fetchResult = await fetchReadings({
          source,
          limit: 2000,
        });

        if (!isActive) return;

        if (fetchResult.error) {
          setError(fetchResult.error);
          return;
        }

        setHistoricalData(fetchResult.readings);
        setLastSync(new Date().toISOString());

        channel = subscribeToReadings({
          source,
          onReading: (reading) => {
            if (!isActive) return;
            addReading(reading);
            setLastSync(new Date().toISOString());
          },
          onError: (message) => {
            if (!isActive) return;
            startPollingFallback(message);
          },
        });

        if (!channel) {
          startPollingFallback('Realtime subscription is unavailable.');
        }
      } catch (cause) {
        if (!isActive) return;
        setError(cause instanceof Error ? cause.message : 'Unexpected error while loading realtime data.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void setupRealtime();

    return () => {
      isActive = false;
      clearPolling();
      unsubscribeFromReadings(channel);
    };
  }, [isRealtime, addReading, setHistoricalData]);

  return {
    loading,
    error,
    warning,
    sourceTable,
    lastSync,
  };
}
