<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bb8966ca-0c62-4b09-924f-c2824574a6a9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure Supabase in `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Optional: `VITE_SUPABASE_READINGS_TABLE` (exact table name)
   - Optional: `VITE_SUPABASE_READINGS_TABLES` (comma-separated fallback table names)
   - Playback simulation:
       - `VITE_PLAYBACK_ENABLED` (`false` for real live data, `true` only to replay from a fixed start timestamp)
     - `VITE_PLAYBACK_START_TIMESTAMP` (example `2025-09-01T00:00:00Z`)
     - `VITE_PLAYBACK_STEP_MINUTES` (data window size moved each step, default `1`)
     - `VITE_PLAYBACK_TICK_MS` (real delay between steps, default `60000`)
     - `VITE_PLAYBACK_WINDOW_LIMIT` (max rows fetched per step)
   - `VITE_PLAYBACK_ROWS_PER_MINUTE` (expected sensor rows per minute, default `20`)
   - `VITE_PLAYBACK_PADDING_MULTIPLIER` (extra ID-range search when a step returns no rows)
3. (Optional) Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
4. Run the app:
   `npm run dev`
