import React, { useState, useEffect } from 'react';
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
  Database
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

    // Set up Socket.IO listener for live updates
    const unsubscribe = socketService.on(SocketEvents.METRICS_UPDATED, (liveData: any) => {
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

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#05070f]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-slate-400 text-sm">Loading dashboard metrics...</span>
        </div>
      </div>
    );
  }

  const statCards = [
    { title: 'Total Jobs', value: metrics?.totalJobs ?? 0, icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { title: 'Active Jobs', value: metrics?.activeJobs ?? 0, icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { title: 'Success Rate', value: `${metrics?.successRate ?? 0}%`, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { title: 'Avg Latency', value: `${metrics?.avgExecutionTimeMs ?? 0}ms`, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  ];

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#05070f] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            System Dashboard
          </h1>
          <p className="text-sm text-slate-400">Real-time status of distributed background queues and workers</p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 px-4 py-2.5 rounded-lg text-sm font-semibold transition"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`glass rounded-xl p-6 border ${card.border} glow-primary`}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.title}</span>
                <div className={`p-2.5 rounded-lg ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-slate-100">{card.value}</h2>
            </div>
          );
        })}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Throughput Area Chart */}
        <div className="lg:col-span-2 glass rounded-xl p-6 border border-slate-800/80">
          <h3 className="text-md font-bold text-slate-200 mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <span>Execution Throughput (Last 7 Days)</span>
          </h3>
          <div className="h-72 w-full">
            {metrics?.throughput && metrics.throughput.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.throughput} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                    labelClassName="text-slate-400 font-semibold"
                  />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
                  <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No throughput data available</div>
            )}
          </div>
        </div>

        {/* Jobs by Status / Quick Overview */}
        <div className="glass rounded-xl p-6 border border-slate-800/80">
          <h3 className="text-md font-bold text-slate-200 mb-6 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" />
            <span>Job Status Breakdown</span>
          </h3>
          <div className="space-y-4">
            {metrics?.jobsByStatus ? (
              Object.entries(metrics.jobsByStatus).map(([status, count]) => {
                const colors: Record<string, string> = {
                  COMPLETED: 'bg-emerald-500 text-emerald-400',
                  FAILED: 'bg-red-500 text-red-400',
                  QUEUED: 'bg-blue-500 text-blue-400',
                  RUNNING: 'bg-amber-500 text-amber-400',
                  SCHEDULED: 'bg-sky-500 text-sky-400',
                  CLAIMED: 'bg-indigo-500 text-indigo-400',
                };
                const colorClass = colors[status] || 'bg-slate-500 text-slate-400';
                return (
                  <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-900">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${colorClass.split(' ')[0]}`} />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{status}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-100">{count}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-500 text-sm">No status data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Queue Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue Health Table */}
        <div className="glass rounded-xl p-6 border border-slate-800/80">
          <h3 className="text-md font-bold text-slate-200 mb-6 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Queue Health & Bottlenecks</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="pb-3">Queue</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Queued</th>
                  <th className="pb-3 text-right">Running</th>
                  <th className="pb-3 text-right text-red-400">DLQ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {metrics?.queueHealth && metrics.queueHealth.length > 0 ? (
                  metrics.queueHealth.map((q) => (
                    <tr key={q.queueId} className="text-slate-300">
                      <td className="py-4 font-semibold text-slate-200">{q.queueName}</td>
                      <td className="py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${q.isPaused ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'}`}>
                          {q.isPaused ? 'PAUSED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-4 text-right font-medium">{q.pending}</td>
                      <td className="py-4 text-right font-medium">{q.processing}</td>
                      <td className="py-4 text-right font-bold text-red-400">{q.deadLetterCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">No queues configured yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Worker Utilization */}
        <div className="glass rounded-xl p-6 border border-slate-800/80">
          <h3 className="text-md font-bold text-slate-200 mb-6 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-500" />
            <span>Worker Pool Status</span>
          </h3>
          <div className="space-y-4">
            {metrics?.workerUtilization && metrics.workerUtilization.length > 0 ? (
              metrics.workerUtilization.map((w) => (
                <div key={w.workerId} className="p-4 rounded-xl bg-slate-950/40 border border-slate-900 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">{w.workerName}</h4>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Last Heartbeat:{' '}
                      {new Date(w.lastHeartbeat).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Total Executions</span>
                      <span className="text-sm font-bold text-slate-100">{w.totalExecuted}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      w.status === 'IDLE' ? 'bg-slate-900 text-slate-400' :
                      w.status === 'BUSY' ? 'bg-blue-950/40 text-blue-400 border border-blue-500/20' :
                      w.status === 'DRAINING' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20' :
                      'bg-red-950/40 text-red-400 border border-red-500/20'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm text-center py-6">No workers connected yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
