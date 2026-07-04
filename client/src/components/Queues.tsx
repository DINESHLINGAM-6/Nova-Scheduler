import React, { useState, useEffect } from 'react';
import api from '../services/api';
import socketService from '../services/socket';
import { Queue, Project, SocketEvents, RetryStrategyType } from '../types';
import { Layers, Plus, Pause, Play, Trash2, Sliders, RefreshCw, X, ChevronRight } from 'lucide-react';

interface QueuesProps {
  user: any;
}

export const Queues: React.FC<QueuesProps> = ({ user }) => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [concurrencyLimit, setConcurrencyLimit] = useState(5);
  const [maxRatePerMinute, setMaxRatePerMinute] = useState<number | ''>('');
  
  // Retry Policy Fields
  const [hasRetryPolicy, setHasRetryPolicy] = useState(false);
  const [policyName, setPolicyName] = useState('Exponential Backoff');
  const [policyType, setPolicyType] = useState<RetryStrategyType>(RetryStrategyType.EXPONENTIAL);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [baseDelayMs, setBaseDelayMs] = useState(1000);
  const [maxDelayMs, setMaxDelayMs] = useState(300000);
  const [backoffMultiplier, setBackoffMultiplier] = useState(2);

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [qRes, pRes]: any = await Promise.all([
        api.get('/queues'),
        api.get('/projects'),
      ]);
      setQueues(qRes.data);
      setProjects(pRes.data);
      if (pRes.data.length > 0) {
        setProjectId(pRes.data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to real-time pause/resume events
    const unsubPause = socketService.on(SocketEvents.QUEUE_PAUSED, (data: any) => {
      setQueues((prev) =>
        prev.map((q) => (q.id === data.queueId ? { ...q, isPaused: true } : q))
      );
    });

    const unsubResume = socketService.on(SocketEvents.QUEUE_RESUMED, (data: any) => {
      setQueues((prev) =>
        prev.map((q) => (q.id === data.queueId ? { ...q, isPaused: false } : q))
      );
    });

    return () => {
      unsubPause();
      unsubResume();
    };
  }, []);

  const handlePauseToggle = async (queue: Queue) => {
    try {
      const endpoint = queue.isPaused ? 'resume' : 'pause';
      await api.post(`/queues/${queue.id}/${endpoint}`);
      // State updates locally via Socket event listener
    } catch (err: any) {
      alert(err.message || 'Failed to toggle queue state');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this queue? All jobs associated with it will be deleted.')) return;
    try {
      await api.delete(`/queues/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete queue');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectId) return;
    setError(null);
    setSubmitting(true);

    try {
      const payload: any = {
        name,
        description: description || undefined,
        projectId,
        concurrencyLimit,
        maxRatePerMinute: maxRatePerMinute ? Number(maxRatePerMinute) : undefined,
      };

      if (hasRetryPolicy) {
        payload.retryPolicy = {
          name: policyName,
          type: policyType,
          maxAttempts,
          baseDelayMs,
          maxDelayMs,
          backoffMultiplier,
        };
      }

      await api.post('/queues', payload);
      setName('');
      setDescription('');
      setConcurrencyLimit(5);
      setMaxRatePerMinute('');
      setHasRetryPolicy(false);
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create queue');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#05070f]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-slate-400 text-sm">Loading queues...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#05070f] min-h-screen relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Job Queues
          </h1>
          <p className="text-sm text-slate-400">Configure scheduling pipelines, concurrency limits, and retry backoff strategies</p>
        </div>
        {projects.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition glow-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Create Queue</span>
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center border border-slate-800/80 max-w-lg mx-auto mt-12">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-2">No Projects Configured</h3>
          <p className="text-sm text-slate-400 mb-6">You must create at least one project before you can configure a job queue.</p>
        </div>
      ) : queues.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center border border-slate-800/80 max-w-lg mx-auto mt-12">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-2">No Queues Configured</h3>
          <p className="text-sm text-slate-400 mb-6">Create a queue inside one of your projects to start running background tasks.</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Configure First Queue
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {queues.map((queue) => (
            <div key={queue.id} className="glass rounded-xl p-6 border border-slate-800/80 flex flex-col justify-between glass-hover group">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200 text-lg group-hover:text-indigo-400 transition-colors">{queue.name}</h3>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Project: {queue.project?.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePauseToggle(queue)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        queue.isPaused
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20 hover:bg-emerald-900/40'
                          : 'bg-amber-950/40 text-amber-400 border-amber-500/20 hover:bg-amber-900/40'
                      }`}
                    >
                      {queue.isPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>
                    {user.role === 'ADMIN' && (
                      <button
                        onClick={() => handleDelete(queue.id)}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded hover:bg-slate-900 transition-colors"
                        title="Delete Queue"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-400 mb-6">{queue.description || 'No description provided.'}</p>

                {/* Queue limits */}
                <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-950/40 border border-slate-900 p-4 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-500 block mb-0.5">Concurrency Limit</span>
                    <span className="text-sm font-bold text-slate-200">{queue.concurrencyLimit} active jobs</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block mb-0.5">Max Rate (Minute)</span>
                    <span className="text-sm font-bold text-slate-200">
                      {queue.maxRatePerMinute ? `${queue.maxRatePerMinute} executions` : 'Unlimited'}
                    </span>
                  </div>
                </div>

                {/* Retry policy configuration */}
                <div className="border-t border-slate-900 pt-4 mt-2">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-3">
                    <Sliders className="w-3.5 h-3.5 text-blue-500" />
                    <span>Retry Strategy</span>
                  </h4>
                  {queue.retryPolicy ? (
                    <div className="space-y-2 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Policy Name:</span>
                        <span className="font-semibold text-slate-300">{queue.retryPolicy.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Strategy Type:</span>
                        <span className="font-semibold text-slate-300">{queue.retryPolicy.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Attempts Cap:</span>
                        <span className="font-semibold text-slate-300">{queue.retryPolicy.maxAttempts} retries</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Backoff Interval:</span>
                        <span className="font-semibold text-slate-300">
                          {queue.retryPolicy.baseDelayMs / 1000}s base &times; {queue.retryPolicy.backoffMultiplier} multiplier (max {queue.retryPolicy.maxDelayMs / 1000}s)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No custom retry policy. Using system defaults.</p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-900 pt-4 mt-6 flex justify-between items-center text-xs text-slate-500">
                <span>Active Jobs: {queue._count?.jobs ?? 0}</span>
                <span className="font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                  ID: {queue.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass rounded-2xl border border-slate-800 w-full max-w-lg overflow-hidden relative glow-primary my-8">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                <span>Configure New Queue</span>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="m-6 p-4 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Queue Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    placeholder="e.g. Email Delivery"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Project Workspace</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition h-16 resize-none"
                  placeholder="Purpose of this queue..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Concurrency Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={concurrencyLimit}
                    onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rate Limit (Per Minute)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxRatePerMinute}
                    onChange={(e) => setMaxRatePerMinute(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Retry policy trigger */}
              <div className="border-t border-slate-850 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Configure Retry Policy</h3>
                    <p className="text-xs text-slate-500">Enable automatic backoffs for failed queue executions</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasRetryPolicy}
                    onChange={(e) => setHasRetryPolicy(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-800 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                </div>

                {hasRetryPolicy && (
                  <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Policy Name</label>
                      <input
                        type="text"
                        required
                        value={policyName}
                        onChange={(e) => setPolicyName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Backoff Strategy</label>
                        <select
                          value={policyType}
                          onChange={(e) => setPolicyType(e.target.value as RetryStrategyType)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        >
                          <option value="FIXED">FIXED (Static delay)</option>
                          <option value="LINEAR">LINEAR (Multiplier delay)</option>
                          <option value="EXPONENTIAL">EXPONENTIAL (Binary backoff)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Max Attempts</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={maxAttempts}
                          onChange={(e) => setMaxAttempts(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Base Delay (ms)</label>
                        <input
                          type="number"
                          min="100"
                          value={baseDelayMs}
                          onChange={(e) => setBaseDelayMs(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Max Delay (ms)</label>
                        <input
                          type="number"
                          min="1000"
                          value={maxDelayMs}
                          onChange={(e) => setMaxDelayMs(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Multiplier</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="0.5"
                          disabled={policyType === 'FIXED'}
                          value={backoffMultiplier}
                          onChange={(e) => setBackoffMultiplier(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none disabled:opacity-30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Configuring...' : 'Configure Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Queues;
