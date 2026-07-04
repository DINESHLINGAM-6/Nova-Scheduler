import React, { useState, useEffect } from 'react';
import api from '../services/api';
import socketService from '../services/socket';
import { Job, Queue, JobStatus, JobType, SocketEvents } from '../types';
import {
  Activity, Plus, Search, Filter, Play, RefreshCw, X, AlertCircle, Clock,
  CheckCircle2, XCircle, Ban, RotateCcw, FileCode, Sliders, ListFilter
} from 'lucide-react';

interface JobsProps {
  user: any;
}

export const Jobs: React.FC<JobsProps> = ({ user }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [queueFilter, setQueueFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create Job Form
  const [name, setName] = useState('');
  const [type, setType] = useState<JobType>(JobType.IMMEDIATE);
  const [queueId, setQueueId] = useState('');
  const [priority, setPriority] = useState(3);
  const [maxRetries, setMaxRetries] = useState(3);
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [scheduledAt, setScheduledAt] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [payloadText, setPayloadText] = useState('{\n  "url": "https://httpbin.org/post",\n  "method": "POST",\n  "body": {\n    "msg": "Hello Nova!"\n  }\n}');
  
  // Batch fields
  const [batchJobsText, setBatchJobsText] = useState('[\n  { "name": "Subtask 1", "payload": { "id": 1 } },\n  { "name": "Subtask 2", "payload": { "id": 2 } }\n]');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const params: any = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (queueFilter) params.queueId = queueFilter;
      if (search) params.search = search;

      const res: any = await api.get('/jobs', { params });
      setJobs(res.data);
      if (res.meta) {
        setTotalPages(res.meta.totalPages);
      }
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
    }
  };

  const fetchQueues = async () => {
    try {
      const res: any = await api.get('/queues');
      setQueues(res.data);
      if (res.data.length > 0) {
        setQueueId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching queues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter, typeFilter, queueFilter, search]);

  useEffect(() => {
    // Socket listener for real-time status changes
    const unsubCreated = socketService.on(SocketEvents.JOB_CREATED, () => fetchJobs());
    const unsubClaimed = socketService.on(SocketEvents.JOB_CLAIMED, () => fetchJobs());
    const unsubStarted = socketService.on(SocketEvents.JOB_STARTED, () => fetchJobs());
    const unsubCompleted = socketService.on(SocketEvents.JOB_COMPLETED, () => fetchJobs());
    const unsubFailed = socketService.on(SocketEvents.JOB_FAILED, () => fetchJobs());
    const unsubRetrying = socketService.on(SocketEvents.JOB_RETRYING, () => fetchJobs());

    return () => {
      unsubCreated();
      unsubClaimed();
      unsubStarted();
      unsubCompleted();
      unsubFailed();
      unsubRetrying();
    };
  }, [page, statusFilter, typeFilter, queueFilter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && type !== JobType.BATCH) return;
    setError(null);
    setSubmitting(true);

    try {
      let parsedPayload = {};
      try {
        if (payloadText.trim()) parsedPayload = JSON.parse(payloadText);
      } catch (pErr) {
        throw new Error('Invalid JSON format in Payload');
      }

      if (type === JobType.BATCH) {
        let parsedBatchJobs = [];
        try {
          parsedBatchJobs = JSON.parse(batchJobsText);
        } catch {
          throw new Error('Invalid JSON format in Batch Jobs list');
        }

        await api.post('/jobs/batch', {
          queueId,
          jobs: parsedBatchJobs,
        });
      } else {
        await api.post('/jobs', {
          name,
          type,
          queueId,
          priority,
          maxRetries,
          timeoutMs,
          payload: parsedPayload,
          scheduledAt: (type === JobType.DELAYED || type === JobType.SCHEDULED) && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          cronExpression: type === JobType.RECURRING ? cronExpression : undefined,
        });
      }

      setName('');
      setShowCreateModal(false);
      fetchJobs();
    } catch (err: any) {
      setError(err.message || 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (job: Job) => {
    try {
      const res: any = await api.get(`/jobs/${job.id}`);
      setSelectedJob(res.data);
      setShowDetailModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load job details');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    try {
      await api.put(`/jobs/${jobId}`, { status: 'CANCELLED' });
      if (selectedJob?.id === jobId) {
        const res: any = await api.get(`/jobs/${jobId}`);
        setSelectedJob(res.data);
      }
      fetchJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel job');
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.post(`/jobs/${jobId}/retry`);
      if (selectedJob?.id === jobId) {
        const res: any = await api.get(`/jobs/${jobId}`);
        setSelectedJob(res.data);
      }
      fetchJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to retry job');
    }
  };

  const getStatusBadge = (status: JobStatus) => {
    const styles: Record<JobStatus, string> = {
      [JobStatus.QUEUED]: 'bg-blue-950/40 text-blue-400 border border-blue-500/20',
      [JobStatus.SCHEDULED]: 'bg-sky-950/40 text-sky-400 border border-sky-500/20',
      [JobStatus.CLAIMED]: 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20',
      [JobStatus.RUNNING]: 'bg-amber-950/40 text-amber-400 border border-amber-500/20 animate-pulse',
      [JobStatus.COMPLETED]: 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20',
      [JobStatus.FAILED]: 'bg-red-950/40 text-red-400 border border-red-500/20',
      [JobStatus.RETRYING]: 'bg-purple-950/40 text-purple-400 border border-purple-500/20',
      [JobStatus.CANCELLED]: 'bg-slate-900 text-slate-400 border border-slate-800',
      [JobStatus.TIMED_OUT]: 'bg-pink-950/40 text-pink-400 border border-pink-500/20',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${styles[status] || 'bg-slate-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#05070f]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-slate-400 text-sm">Loading jobs engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#05070f] min-h-screen relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Jobs & Triggers
          </h1>
          <p className="text-sm text-slate-400">Trigger immediate, delayed, recurring, or batch executions and monitor their lifecycles</p>
        </div>
        {queues.length > 0 && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition glow-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Trigger Job</span>
          </button>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="glass rounded-xl p-4 border border-slate-800/80 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          {/* Search */}
          <div className="relative max-w-xs w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search job or batch ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 pl-9 pr-4 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Queue Filter */}
          <div className="relative">
            <select
              value={queueFilter}
              onChange={(e) => { setQueueFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 text-xs text-slate-400 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Queues</option>
              {queues.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 text-xs text-slate-400 focus:outline-none"
            >
              <option value="">All Statuses</option>
              {Object.keys(JobStatus).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 text-xs text-slate-400 focus:outline-none"
            >
              <option value="">All Types</option>
              {Object.keys(JobType).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Jobs table */}
      <div className="glass rounded-xl border border-slate-800/80 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-6">Job Name</th>
                <th className="py-3 px-4">Queue</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-center">Priority</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Attempts</th>
                <th className="py-3 px-4 text-right">Created At</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {jobs.length > 0 ? (
                jobs.map((job) => (
                  <tr key={job.id} className="text-slate-300 hover:bg-slate-900/30 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-200">
                      <button
                        onClick={() => handleViewDetails(job)}
                        className="text-left hover:text-blue-400 transition"
                      >
                        {job.name}
                        {job.batchId && (
                          <span className="block font-mono text-[9px] text-slate-500 mt-0.5">Batch: {job.batchId}</span>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-xs">{job.queue?.name}</td>
                    <td className="py-4 px-4 text-center font-mono text-[10px] text-slate-400">{job.type}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        job.priority <= 2 ? 'bg-red-950/30 text-red-400 border border-red-500/20' :
                        job.priority === 3 ? 'bg-amber-950/30 text-amber-400 border border-amber-500/20' :
                        'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        P{job.priority}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">{getStatusBadge(job.status)}</td>
                    <td className="py-4 px-4 text-center text-xs font-mono">{job.retryCount} / {job.maxRetries}</td>
                    <td className="py-4 px-4 text-right text-xs text-slate-500">{new Date(job.createdAt).toLocaleString()}</td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleViewDetails(job)}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition"
                      >
                        Details
                      </button>
                      {['QUEUED', 'SCHEDULED', 'RETRYING', 'RUNNING'].includes(job.status) && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          className="text-xs font-bold text-slate-500 hover:text-red-400 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">No jobs matching selected filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400 bg-slate-950/20">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Trigger Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass rounded-2xl border border-slate-800 w-full max-w-lg overflow-hidden relative glow-primary my-8">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <span>Trigger Background Job</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
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

            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Job Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as JobType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="IMMEDIATE">IMMEDIATE (Now)</option>
                    <option value="DELAYED">DELAYED (Later)</option>
                    <option value="SCHEDULED">SCHEDULED (Datetime)</option>
                    <option value="RECURRING">RECURRING (Cron)</option>
                    <option value="BATCH">BATCH (Multiple)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Queue</label>
                  <select
                    value={queueId}
                    onChange={(e) => setQueueId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none"
                  >
                    {queues.map((q) => (
                      <option key={q.id} value={q.id}>{q.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {type !== JobType.BATCH && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Job Identifier Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 focus:outline-none"
                      placeholder="e.g. Sync User Profiles"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Priority (1-5)</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={priority}
                        onChange={(e) => setPriority(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Max Retries</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={maxRetries}
                        onChange={(e) => setMaxRetries(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Timeout (ms)</label>
                      <input
                        type="number"
                        min="1000"
                        value={timeoutMs}
                        onChange={(e) => setTimeoutMs(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Delayed / Scheduled datetime field */}
              {(type === JobType.DELAYED || type === JobType.SCHEDULED) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Scheduled Execution Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none"
                  />
                </div>
              )}

              {/* Recurring cron field */}
              {type === JobType.RECURRING && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cron Expression</label>
                  <input
                    type="text"
                    required
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 focus:outline-none font-mono"
                    placeholder="e.g. */5 * * * * (Every 5 mins)"
                  />
                </div>
              )}

              {/* Batch job JSON array */}
              {type === JobType.BATCH ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Batch Jobs List (JSON Array)</label>
                  <textarea
                    required
                    value={batchJobsText}
                    onChange={(e) => setBatchJobsText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 font-mono h-40 focus:outline-none"
                  />
                </div>
              ) : (
                /* Single Job Payload builder */
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Job Payload (JSON)</label>
                  <textarea
                    required
                    value={payloadText}
                    onChange={(e) => setPayloadText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 font-mono h-32 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Triggering...' : 'Trigger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {showDetailModal && selectedJob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass rounded-2xl border border-slate-800 w-full max-w-3xl overflow-hidden relative glow-primary my-8">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase block mb-1">Queue: {selectedJob.queue?.name}</span>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>{selectedJob.name}</span>
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
                  <span className="text-slate-500 block mb-0.5">Status</span>
                  <span>{getStatusBadge(selectedJob.status)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Type</span>
                  <span className="font-mono text-slate-200">{selectedJob.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Priority</span>
                  <span className="font-semibold text-slate-200">P{selectedJob.priority}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Retry Attempts</span>
                  <span className="font-mono text-slate-200">{selectedJob.retryCount} / {selectedJob.maxRetries}</span>
                </div>
              </div>

              {/* Payload Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-blue-500" />
                  <span>Payload data</span>
                </h4>
                <pre className="bg-slate-950 border border-slate-900 p-4 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>

              {/* Executions log timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Execution Runs ({selectedJob.executions?.length || 0})</span>
                </h4>
                {selectedJob.executions && selectedJob.executions.length > 0 ? (
                  <div className="space-y-3">
                    {selectedJob.executions.map((exec) => (
                      <div key={exec.id} className="p-4 rounded-xl bg-slate-950/30 border border-slate-900/60 text-xs text-slate-300">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-slate-200">Attempt #{exec.attempt}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            exec.status === 'COMPLETED' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' : 'bg-red-950/40 text-red-400 border border-red-500/20'
                          }`}>{exec.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-400 mt-2">
                          <div><span className="text-slate-500">Worker:</span> {exec.worker?.name || exec.workerId}</div>
                          <div><span className="text-slate-500">Duration:</span> {exec.durationMs ? `${exec.durationMs}ms` : 'N/A'}</div>
                        </div>
                        {exec.error && (
                          <div className="mt-3 p-3 bg-red-950/20 border border-red-950 rounded-lg text-red-400 font-mono text-[10px] overflow-x-auto leading-relaxed">
                            {exec.error}
                            {exec.errorStack && <span className="block mt-1 text-[9px] opacity-60 max-h-24 overflow-y-auto whitespace-pre-wrap">{exec.errorStack}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No executions have run yet.</p>
                )}
              </div>

              {/* Logs */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ListFilter className="w-3.5 h-3.5 text-sky-500" />
                  <span>Job Logger Outputs</span>
                </h4>
                {selectedJob.logs && selectedJob.logs.length > 0 ? (
                  <div className="bg-slate-950 border border-slate-900 rounded-lg overflow-hidden divide-y divide-slate-900 max-h-48 overflow-y-auto">
                    {selectedJob.logs.map((log) => (
                      <div key={log.id} className="p-3 text-xs font-mono flex justify-between items-start gap-4">
                        <div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mr-2 ${
                            log.level === 'ERROR' ? 'bg-red-950/40 text-red-400 border border-red-500/20' :
                            log.level === 'WARN' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20' :
                            'bg-slate-900 text-slate-500 border border-slate-800'
                          }`}>{log.level}</span>
                          <span className="text-slate-300">{log.message}</span>
                        </div>
                        <span className="text-slate-500 text-[10px] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No log entries found.</p>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-6 border-t border-slate-800 flex justify-between items-center bg-slate-950/20">
              <span className="text-xs font-mono text-slate-500">ID: {selectedJob.id}</span>
              <div className="flex gap-2">
                {['FAILED', 'TIMED_OUT', 'CANCELLED'].includes(selectedJob.status) && (
                  <button
                    onClick={() => handleRetryJob(selectedJob.id)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Job</span>
                  </button>
                )}
                {['QUEUED', 'SCHEDULED', 'RETRYING', 'RUNNING'].includes(selectedJob.status) && (
                  <button
                    onClick={() => handleCancelJob(selectedJob.id)}
                    className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-900/20 px-4 py-2 rounded-lg text-xs font-semibold transition"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancel Job</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Jobs;
