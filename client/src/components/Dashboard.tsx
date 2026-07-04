import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import socketService from '../services/socket';
import { SocketEvents, DashboardMetrics, WorkerStatus } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  Terminal,
  Signal,
  ArrowUpRight,
  Zap
} from 'lucide-react';


interface ConsoleLogEntry {
  id: string;
  time: string;
  event: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const fetchMetrics = async () => {
    try {
      const res: any = await api.get('/metrics/dashboard');
      setMetrics(res.data);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Set up Socket.IO listener for live metrics
    const unsubscribeMetrics = socketService.on(SocketEvents.METRICS_UPDATED, (liveData: any) => {
      console.log('📈 Live metrics update received via socket:', liveData);
      setMetrics((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          jobsByStatus: {
            ...prev.jobsByStatus,
            ...liveData.jobsByStatus,
          },
          workerUtilization: prev.workerUtilization.map((w) => {
            const wStatus = liveData.workersByStatus?.[w.workerId];
            if (wStatus) {
              return { ...w, status: wStatus as WorkerStatus };
            }
            return w;
          }),
        };
      });
    });

    // Helper to push logs to our terminal stream
    const addLog = (event: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
      setConsoleLogs((prev) => [
        {
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          event,
          message,
          type
        },
        ...prev.slice(0, 24) // limit to 25 logs
      ]);
    };

    // Pre-populate system start log
    addLog('system', 'Nova Telemetry listener established. Waiting for jobs...', 'info');

    // Attach listeners for live system events
    const unsubCreated = socketService.on(SocketEvents.JOB_CREATED, (d: any) => {
      addLog('job:created', `Job "${d.name || d.id}" created & queued.`, 'info');
      fetchMetrics();
    });
    const unsubClaimed = socketService.on(SocketEvents.JOB_CLAIMED, (d: any) => {
      addLog('job:claimed', `Worker claimed job "${d.name || d.jobId || d.id}".`, 'warning');
      fetchMetrics();
    });
    const unsubStarted = socketService.on(SocketEvents.JOB_STARTED, (d: any) => {
      addLog('job:started', `Job execution initiated.`, 'warning');
      fetchMetrics();
    });
    const unsubCompleted = socketService.on(SocketEvents.JOB_COMPLETED, (d: any) => {
      addLog('job:done', `Job completed successfully in ${d.durationMs ?? 0}ms.`, 'success');
      fetchMetrics();
    });
    const unsubFailed = socketService.on(SocketEvents.JOB_FAILED, (d: any) => {
      addLog('job:failed', `Execution failed: ${d.error || 'Task error'}`, 'error');
      fetchMetrics();
    });
    const unsubOnline = socketService.on(SocketEvents.WORKER_ONLINE, (d: any) => {
      addLog('worker:up', `Worker "${d.name || d.id}" is online.`, 'success');
      fetchMetrics();
    });
    const unsubOffline = socketService.on(SocketEvents.WORKER_OFFLINE, (d: any) => {
      addLog('worker:down', `Worker "${d.name || d.id}" went offline.`, 'error');
      fetchMetrics();
    });

    return () => {
      unsubscribeMetrics();
      unsubCreated();
      unsubClaimed();
      unsubStarted();
      unsubCompleted();
      unsubFailed();
      unsubOnline();
      unsubOffline();
    };
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
            <div className="absolute w-14 h-14 border border-cyan-400/30 rounded-full animate-ping" />
          </div>
          <span className="text-cyan-400/80 font-mono text-sm tracking-wider uppercase animate-pulse">Initializing Telemetry...</span>
        </div>
      </div>
    );
  }

  const statCards = [
    { title: 'Total Jobs', value: metrics?.totalJobs ?? 0, icon: Database, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'hover:border-cyan-500/30' },
    { title: 'Active Jobs', value: metrics?.activeJobs ?? 0, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'hover:border-purple-500/30' },
    { title: 'Success Rate', value: `${metrics?.successRate ?? 0}%`, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'hover:border-emerald-500/30' },
    { title: 'Avg Latency', value: `${metrics?.avgExecutionTimeMs ?? 0}ms`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'hover:border-amber-500/30' },
  ];

  return (
    <div className="flex-1 p-8 overflow-y-auto min-h-screen bg-transparent">
      {/* Header and status indicators */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 border-b border-slate-800/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Nova Scheduler Engine</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">v1.0.0</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            System Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time status of distributed background queues and workers</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick status lights */}
          <div className="flex items-center gap-4 bg-slate-950/40 border border-slate-800/60 px-4 py-2 rounded-xl text-xs font-mono text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
              <span>DB: OK</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] animate-pulse" />
              <span>SOCKET: ACTIVE</span>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-slate-900/60 backdrop-blur border border-slate-800 hover:border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Stats</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`glass rounded-2xl p-6 border border-slate-800/80 transition-all duration-300 hover:-translate-y-1 ${card.border} group`}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">{card.title}</span>
                <div className={`p-2 rounded-xl ${card.bg} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <h2 className="text-3xl font-extrabold text-slate-50 font-mono tracking-tight">{card.value}</h2>
                <span className="text-[10px] text-cyan-400 font-semibold font-mono flex items-center">
                  <ArrowUpRight className="w-3 h-3" />
                  Live
                </span>
              </div>
              <div className="w-full bg-slate-950/40 rounded-full h-1 mt-4 overflow-hidden border border-slate-900">
                <div className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full rounded-full animate-pulse" style={{ width: '70%' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & Interactive Log Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Throughput Area Chart */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Throughput Trend & Execution Analysis</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">7-Day Sample Period</span>
          </div>
          <div className="h-72 w-full">
            {metrics?.throughput && metrics.throughput.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.throughput} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.2} />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px' }}
                    labelClassName="text-slate-400 font-bold font-mono text-xs"
                  />
                  <Area type="monotone" dataKey="completed" name="Successes" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="failed" name="Failures" stroke="#ec4899" fillOpacity={1} fill="url(#colorFailed)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">No throughput data recorded</div>
            )}
          </div>
        </div>

        {/* Live System Log Screen */}
        <div className="glass rounded-2xl border border-slate-800/80 flex flex-col h-[356px] overflow-hidden">
          <div className="bg-slate-950/60 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 font-mono tracking-wide">Live Log Stream</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] font-mono text-emerald-400 font-semibold uppercase">Listening</span>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] space-y-2 bg-slate-950/40 custom-scrollbar select-none">
            {consoleLogs.map((log) => {
              const typeColors = {
                info: 'text-cyan-400',
                success: 'text-emerald-400',
                warning: 'text-amber-400',
                error: 'text-rose-400'
              };
              return (
                <div key={log.id} className="hover:bg-slate-900/40 p-1 rounded transition duration-150">
                  <span className="text-slate-500 mr-1.5">[{log.time}]</span>
                  <span className={`font-bold mr-1.5 ${typeColors[log.type]}`}>[{log.event}]</span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              );
            })}
            <div ref={consoleEndRef} />
          </div>
        </div>
      </div>

      {/* Queue Health and Worker Pools */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue Health & Statistics */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 border border-slate-800/80">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Queue Metrics & Bottlenecks</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Heartbeat check ok</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 text-left">Queue ID</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Queued</th>
                  <th className="pb-3 text-right">Running</th>
                  <th className="pb-3 text-right text-rose-400">Dead Letter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {metrics?.queueHealth && metrics.queueHealth.length > 0 ? (
                  metrics.queueHealth.map((q) => (
                    <tr key={q.queueId} className="text-slate-300 hover:bg-slate-900/10 transition">
                      <td className="py-3.5 text-left font-semibold text-slate-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        {q.queueName}
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${q.isPaused ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                          {q.isPaused ? 'PAUSED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right text-slate-200 font-bold">{q.pending}</td>
                      <td className="py-3.5 text-right text-slate-200 font-bold">{q.processing}</td>
                      <td className="py-3.5 text-right font-extrabold text-rose-400">{q.deadLetterCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">No queues configured in database</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Worker Pool Status */}
        <div className="glass rounded-2xl p-6 border border-slate-800/80 flex flex-col justify-between">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Active Worker Pool</span>
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 animate-pulse">Pool Size: {metrics?.workerUtilization?.length ?? 0}</span>
          </div>
          <div className="space-y-3.5 max-h-[224px] overflow-y-auto pr-1">
            {metrics?.workerUtilization && metrics.workerUtilization.length > 0 ? (
              metrics.workerUtilization.map((w) => (
                <div key={w.workerId} className="p-3.5 rounded-xl bg-slate-950/30 border border-slate-800/40 hover:border-slate-800 flex justify-between items-center transition duration-300">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-100 text-xs font-mono flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      {w.workerName}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono mt-1">
                      HB: {new Date(w.lastHeartbeat).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                      w.status === 'IDLE' ? 'bg-slate-900 text-slate-400' :
                      w.status === 'BUSY' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                      w.status === 'DRAINING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs font-mono text-center py-8">No workers registered in database. Ensure local runner is executing tasks.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
