import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Droplets, Wind, TrendingUp, TrendingDown } from 'lucide-react';
import { useSensorModalStore } from '../../store/useSensorModalStore';

interface KPICardProps {
  data: any;
}

const iconMap: Record<string, React.FC<any>> = {
  pH: Droplets,
  TSS: Activity,
  COD: Wind,
  BOD: Activity,
  TN: Activity,
  TP: Activity,
  MLSS: Activity,
  Ammonia: Activity,
  Airflow: Wind,
  'Flow Rate (In)': Wind,
  'Flow Rate (Out)': Wind,
  Temperature: Activity,
  OTE: Activity,
  'Chlorine Dose': Droplets,
  'Sludge Level': Activity,
  'Power Consumption': Activity,
  SVI: Activity,
  'Pump 2 Status': Activity,
  'Chlorine Residual': Droplets,
};

export function KPICard({ data }: KPICardProps) {
  const openModal = useSensorModalStore((state) => state.openModal);

  if (!data) return null;

  const { name, unit, status, trend } = data;
  const value = data.currentValue ?? data.value ?? 0;
  const Icon = iconMap[name] || Activity;

  const trendValue = trend === 'up' ? 1 : trend === 'down' ? -1 : 0;
  const statusStr = status ? status.toLowerCase() : 'normal';

  const getStatusColor = () => {
    switch (statusStr) {
      case 'critical': return 'bg-rose-50 border-rose-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      default: return 'bg-emerald-50 border-emerald-200';
    }
  };

  const getAccentColor = () => {
    switch (statusStr) {
      case 'critical': return 'text-rose-500';
      case 'warning': return 'text-amber-500';
      default: return 'text-emerald-500';
    }
  };

  const handleClick = () => {
    openModal(data);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={handleClick}
      className={'relative overflow-hidden rounded-2xl p-6 border transition-all cursor-pointer backdrop-blur-xl ' + getStatusColor()}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-700 font-semibold">{name}</h3>
          <div className="p-2 rounded-lg bg-white/70 border border-white/70">
            <Icon className={'w-5 h-5 ' + getAccentColor()} />
          </div>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-4xl font-bold text-gray-900 tracking-tight">
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          <span className="text-lg text-gray-700 font-medium">{unit}</span>
        </div>

        {trend && (
          <div className="mt-4 flex items-center space-x-2">
            <span className={'flex items-center text-sm font-medium ' + (trendValue > 0 ? 'text-rose-600' : trendValue < 0 ? 'text-emerald-600' : 'text-slate-700')}>
              {trendValue > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {trend}
            </span>
            <span className="text-sm text-slate-600">vs last hour</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
