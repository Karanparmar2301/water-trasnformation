import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardView } from './pages/DashboardView';
import { SensorDetailPage } from './pages/SensorDetailPage';
import { useRealtimeSensors } from './hooks/useRealtimeSensors';
import { useHistoricalData } from './hooks/useHistoricalData';
import { useStore } from './store/useStore';

export default function App() {
  const { isRealtime, historicalHours } = useStore();

  // Initialize global data hooks so data continuously updates in the background
  const realtimeStatus = useRealtimeSensors();
  const historicalStatus = useHistoricalData(historicalHours);

  const activeDataStatus = isRealtime ? realtimeStatus : historicalStatus;

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardView activeDataStatus={activeDataStatus} />} />
          <Route path="/sensor/:sensorName" element={<SensorDetailPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
