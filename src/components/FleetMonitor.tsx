import React, { useState } from 'react';
import { DeviceInfo } from '../types';
import { Cpu, Activity, Play, ArrowRight, Gauge, MapPin } from 'lucide-react';

interface FleetMonitorProps {
  devices: DeviceInfo[];
  onSelectDeviceForQuery: (deviceId: string) => void;
}

export const FleetMonitor: React.FC<FleetMonitorProps> = ({
  devices,
  onSelectDeviceForQuery
}) => {
  const [selectedFactory, setSelectedFactory] = useState<string>('all');

  const filteredDevices = selectedFactory === 'all'
    ? devices
    : devices.filter(d => d.factory_id === selectedFactory);

  return (
    <div className="border border-zinc-200/90 bg-white rounded-xl p-5 space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
            <span>EDGE NODE CLUSTER</span>
            <span className="text-zinc-300">·</span>
            <span>10 PROVISIONED UNITS</span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight mt-0.5">
            Industrial Machine Fleet Telemetry
          </h3>
        </div>

        {/* Factory Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-50 rounded-lg border border-zinc-200 text-xs font-medium overflow-x-auto">
          {['all', 'FAC-01', 'FAC-02', 'FAC-03'].map((facId) => (
            <button
              key={facId}
              onClick={() => setSelectedFactory(facId)}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                selectedFactory === facId
                  ? 'bg-white text-zinc-900 font-semibold shadow-2xs border border-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {facId === 'all' ? 'All Units' : facId}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredDevices.map((dev) => {
          return (
            <div
              key={dev.device_id}
              className="p-3.5 rounded-lg bg-zinc-50/50 border border-zinc-200/80 hover:border-zinc-300 hover:bg-white transition-all space-y-2.5 flex flex-col justify-between shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-zinc-900 text-xs">
                    {dev.device_id}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-zinc-700 border border-zinc-200 uppercase font-medium">
                    {dev.sensor_type}
                  </span>
                </div>

                <div className="text-xs text-zinc-700 font-medium">{dev.model}</div>

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span className="truncate">{dev.location}</span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-zinc-200/80 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500 text-[11px]">{dev.sampling_rate_hz} Hz sampling</span>
                <button
                  onClick={() => onSelectDeviceForQuery(dev.device_id)}
                  className="flex items-center gap-1 text-zinc-700 hover:text-zinc-950 font-sans text-xs font-medium py-1 px-2 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <span>Query</span>
                  <ArrowRight className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
