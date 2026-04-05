import { create } from 'zustand';
import { ProcessedSensorData } from '../types';

interface SensorModalState {
  selectedSensor: ProcessedSensorData | null;
  isModalOpen: boolean;
  openModal: (sensor: ProcessedSensorData) => void;
  closeModal: () => void;
}

export const useSensorModalStore = create<SensorModalState>((set) => ({
  selectedSensor: null,
  isModalOpen: false,
  openModal: (sensor) => set({ selectedSensor: sensor, isModalOpen: true }),
  closeModal: () => set({ selectedSensor: null, isModalOpen: false }),
}));