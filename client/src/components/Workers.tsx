import React, { useState, useEffect } from 'react';
import api from '../services/api';
import socketService from '../services/socket';
import { Worker, SocketEvents } from '../types';
import { Cpu, RefreshCw, X, ShieldAlert, CpuIcon, Activity, ServerCrash } from 'lucide-react';

export const Workers: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchWorkers = async () => {
    try {
      const res: any = await api.get('/workers');
      setWorkers(res.data);
    } catch (err: any) {
      console.error('Error fetching workers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();

    // Socket.IO event updates for live worker heartbeat and registration
    const unsubOnline = socketService.on(SocketEvents.WORKER_ONLINE, (worker: Worker) => {
      setWorkers((prev) => {
        const exists = prev.some((w) => w.id === worker.id);
        if (exists) {
          return prev.map((w) => (w.id === worker.id ? worker : w));
        }
        return [worker, ...prev];
      });
    });

    const unsubOffline = socketService.on(SocketEvents.WORKER_OFFLINE, (worker: Worker) => {
      setWorkers((prev) => prev.map((w) => (w.id === worker.id ? { ...w, status: worker.status } : w)));
    });

    const unsubHeartbeat = socketService.on(SocketEvents.WORKER_HEARTBEAT, (data: any) => {
      setWorkers((prev) =>
        prev.map((w) => (w.id === data.worker.id ? { ...w, ...data.worker } : w))
      );
      // Update selected worker live if modal open
      setSelectedWorker((prev) => {
        if (prev && prev.id === data.worker.id) {
          const heartbeats = prev.heartbeats ? [data.heartbeat, ...prev.heartbeats].slice(0, 20) : [data.heartbeat];
          return { ...prev, ...data.worker, heartbeats };
        }
        return prev;
      });
    });

    return () => {
      unsubOnline();
      unsubOffline();
      unsubHeartbeat();
    };
  }, []);

  const handleViewWorker = async (worker: Worker) => {
    try {
      const res: any = await api.get(`/workers/${worker.id}`);
      setSelectedWorker(res.data);
      setShowDetailModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch worker details');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#05070f]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-slate-400 text-sm">Loading connected workers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#05070f] min-h-screen relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <Cpu className="w-8 h-8 text-blue-500" />
            <span>Worker Node Pool</span>
          </h1>
          <p className="text-sm text-slate-400">Monitor system load averages, active jobs, memory utilization, and node status</p>
        </div>
      </div>

      {/* Workers list */}
      {workers.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center border border-slate-800/80 max-w-lg mx-auto mt-12">
          <ServerCrash className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-2">No Workers Registered</h3>
          <p className="text-sm text-slate-400">Start a worker process in the backend to begin processing job queues.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <div key={worker.id} className="glass rounded-xl p-6 border border-slate-800/80 flex flex-col justify-between glass-hover group">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <CpuIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200 text-sm group-hover:text-blue-400 transition-colors truncate max-w-[150px]" title={worker.name}>
                        {worker.name}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">PID: {worker.pid || 'N/A'}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    worker.status === 'IDLE' ? 'bg-slate-900 text-slate-400 border border-slate-800' :
                    worker.status === 'BUSY' ? 'bg-blue-950/40 text-blue-400 border border-blue-500/20 animate-pulse' :
                    worker.status === 'DRAINING' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20' :
                    'bg-red-950/40 text-red-400 border border-red-500/20'
                  }`}>
                    {worker.status}
                  </span>
                </div>

                <div className="space-y-2.5 my-5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Hostname:</span>
                    <span className="font-medium text-slate-300">{worker.hostname || 'Local'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Concurrency Capacity:</span>
                    <span className="font-semibold text-slate-300">{worker.concurrency} concurrent slots</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Jobs Executed:</span>
                    <span className="font-bold text-slate-300">{worker._count?.executions ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-900 pt-4 mt-2 flex justify-between items-center text-xs text-slate-500">
                <span>Heartbeat: {new Date(worker.lastHeartbeat).toLocaleTimeString()}</span>
                <button
                  onClick={() => handleViewWorker(worker)}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 transition"
                >
                  Analyze Node &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Worker Inspect Modal */}
      {showDetailModal && selectedWorker && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-slate-800 w-full max-w-3xl overflow-hidden relative glow-primary">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase block mb-1">Worker Pool Metrics</span>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>{selectedWorker.name}</span>
                </h2>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Properties Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">Node Status</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedWorker.status === 'IDLE' ? 'bg-slate-900 text-slate-400' :
                    selectedWorker.status === 'BUSY' ? 'bg-blue-950/40 text-blue-400' :
                    'bg-red-950/40 text-red-400'
                  }`}>{selectedWorker.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">CPU Avg Load (1m)</span>
                  <span className="font-semibold text-slate-200">{selectedWorker.heartbeats?.[0]?.cpuUsage ?? 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Memory Usage</span>
                  <span className="font-semibold text-slate-200">
                    {selectedWorker.heartbeats?.[0]?.memoryUsage ? `${Math.round(selectedWorker.heartbeats[0].memoryUsage)} MB` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Active Executing Jobs</span>
                  <span className="font-bold text-slate-200">{selectedWorker.heartbeats?.[0]?.activeJobs ?? 0}</span>
                </div>
              </div>

              {/* Heartbeat history */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Telemetry Heartbeats (Last 20 Runs)</span>
                </h4>
                {selectedWorker.heartbeats && selectedWorker.heartbeats.length > 0 ? (
                  <div className="bg-slate-950 border border-slate-900 rounded-lg overflow-hidden divide-y divide-slate-900/60 max-h-48 overflow-y-auto">
                    {selectedWorker.heartbeats.map((hb) => (
                      <div key={hb.id} className="p-3 text-[11px] font-mono flex justify-between items-center text-slate-300">
                        <div className="flex gap-4">
                          <span>CPU: <strong className="text-slate-100">{hb.cpuUsage ?? 'N/A'}</strong></span>
                          <span>Memory: <strong className="text-slate-100">{hb.memoryUsage ? `${Math.round(hb.memoryUsage)}MB` : 'N/A'}</strong></span>
                          <span>Active Jobs: <strong className="text-slate-100">{hb.activeJobs}</strong></span>
                        </div>
                        <span className="text-slate-500 text-[10px]">{new Date(hb.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No heartbeats received yet.</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-between items-center bg-slate-950/20">
              <span className="text-xs font-mono text-slate-500">ID: {selectedWorker.id}</span>
              <button
                onClick={() => setShowDetailModal(false)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Workers;
