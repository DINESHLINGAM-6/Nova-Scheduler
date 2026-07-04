import React, { useState, useEffect } from 'react';
import api from '../services/api';
import socketService from '../services/socket';
import { Worker, SocketEvents } from '../types';
import { Cpu, RefreshCw, X, ShieldAlert, CpuIcon, Activity, ServerCrash, Zap, HardDrive, Terminal } from 'lucide-react';

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
      <div className="flex-1 flex items-center justify-center min-h-screen bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
            <div className="absolute w-14 h-14 border border-cyan-400/30 rounded-full animate-ping" />
          </div>
          <span className="text-cyan-400/80 font-mono text-sm tracking-wider uppercase animate-pulse">Scanning pool...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto min-h-screen bg-transparent relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Cluster Pool</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">Active Slots</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
            <span>Worker Node Registry</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Monitor system load averages, active jobs, memory utilization, and Node health status</p>
        </div>
      </div>

      {/* Workers list */}
      {workers.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-slate-800/85 max-w-lg mx-auto mt-12 shadow-2xl">
          <ServerCrash className="w-14 h-14 text-rose-500/70 mx-auto mb-4 animate-bounce" />
          <h3 className="text-lg font-bold text-slate-200 mb-2">No Connected Nodes</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            There are no active runners communicating with the Nova Scheduler engine. Start a local worker node CLI or docker worker instance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <div key={worker.id} className="glass rounded-2xl p-6 border border-slate-800/80 flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/5 group">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 text-cyan-400">
                      <CpuIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200 text-sm group-hover:text-cyan-400 transition-colors duration-300 truncate max-w-[150px]" title={worker.name}>
                        {worker.name}
                      </h3>
                      <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">PID: {worker.pid || 'N/A'}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                    worker.status === 'IDLE' ? 'bg-slate-900 text-slate-400 border border-slate-800' :
                    worker.status === 'BUSY' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse' :
                    worker.status === 'DRAINING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {worker.status}
                  </span>
                </div>

                <div className="space-y-3 my-6 text-xs font-mono text-slate-400">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>Host Node</span>
                    <span className="font-medium text-slate-200">{worker.hostname || 'Localhost'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>Concurrency Slot</span>
                    <span className="font-semibold text-cyan-400">{worker.concurrency} channels</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>Total Jobs Executed</span>
                    <span className="font-bold text-slate-200">{worker._count?.executions ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-900/60 pt-4 mt-2 flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>Last HB: {new Date(worker.lastHeartbeat).toLocaleTimeString()}</span>
                <button
                  onClick={() => handleViewWorker(worker)}
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition duration-150 flex items-center gap-1 group-hover:translate-x-1"
                >
                  Inspect Node &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Worker Inspect Modal */}
      {showDetailModal && selectedWorker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass rounded-3xl border border-slate-800/80 w-full max-w-3xl overflow-hidden relative shadow-[0_20px_50px_rgba(6,182,212,0.15)]">
            <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-950/20">
              <div>
                <span className="text-[10px] text-cyan-400 font-mono font-bold tracking-wider uppercase block mb-1">Worker Telemetry Inspect</span>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <span>{selectedWorker.name}</span>
                </h2>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
              {/* Properties Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-900/60 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block mb-1">State</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    selectedWorker.status === 'IDLE' ? 'bg-slate-900 text-slate-400' :
                    selectedWorker.status === 'BUSY' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                    'bg-rose-500/10 text-rose-400'
                  }`}>{selectedWorker.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">CPU Load</span>
                  <span className="font-bold text-slate-200">{selectedWorker.heartbeats?.[0]?.cpuUsage ? `${selectedWorker.heartbeats[0].cpuUsage}%` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Ram Allocated</span>
                  <span className="font-bold text-slate-200">
                    {selectedWorker.heartbeats?.[0]?.memoryUsage ? `${Math.round(selectedWorker.heartbeats[0].memoryUsage)} MB` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Active Slots</span>
                  <span className="font-bold text-cyan-400">{selectedWorker.heartbeats?.[0]?.activeJobs ?? 0} runs</span>
                </div>
              </div>

              {/* Heartbeat history */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono mb-3.5 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>Telemetry Pulse (Last 20 Runs)</span>
                </h4>
                {selectedWorker.heartbeats && selectedWorker.heartbeats.length > 0 ? (
                  <div className="bg-slate-950/60 border border-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-900/50 max-h-56 overflow-y-auto">
                    {selectedWorker.heartbeats.map((hb) => (
                      <div key={hb.id} className="p-3 text-[10px] font-mono flex justify-between items-center text-slate-400 hover:bg-slate-900/10">
                        <div className="flex gap-4">
                          <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-cyan-500" /> CPU: <strong className="text-slate-200">{hb.cpuUsage ?? 'N/A'}%</strong></span>
                          <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-purple-500" /> MEM: <strong className="text-slate-200">{hb.memoryUsage ? `${Math.round(hb.memoryUsage)}MB` : 'N/A'}</strong></span>
                          <span className="flex items-center gap-1"><Terminal className="w-3 h-3 text-amber-500" /> JOBS: <strong className="text-slate-200">{hb.activeJobs}</strong></span>
                        </div>
                        <span className="text-slate-500 text-[9px]">{new Date(hb.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic font-mono">No telemetry heartbeat packets received.</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800/60 flex justify-between items-center bg-slate-950/40">
              <span className="text-[10px] font-mono text-slate-500">ID: {selectedWorker.id}</span>
              <button
                onClick={() => setShowDetailModal(false)}
                className="bg-gradient-to-r from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900 text-slate-300 border border-slate-800/80 px-5 py-2 rounded-xl text-xs font-semibold transition hover:shadow-md"
              >
                Close Metrics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workers;
