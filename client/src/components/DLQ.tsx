import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { DeadLetterEntry } from '../types';
import { AlertTriangle, RefreshCw, Trash2, RotateCcw, X, ShieldAlert } from 'lucide-react';

export const DLQ: React.FC = () => {
  const [entries, setEntries] = useState<DeadLetterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<DeadLetterEntry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [purging, setPurging] = useState(false);

  const fetchDLQ = async () => {
    try {
      const res: any = await api.get('/metrics/dlq?page=1&limit=50');
      setEntries(res.data);
    } catch (err: any) {
      console.error('Error fetching DLQ entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDLQ();
  }, []);

  const handleRetry = async (entry: DeadLetterEntry) => {
    try {
      // Run the retry API on the job
      await api.post(`/jobs/${entry.originalJobId}/retry`);
      setShowDetailModal(false);
      fetchDLQ();
    } catch (err: any) {
      alert(err.message || 'Failed to retry job from DLQ');
    }
  };

  const handlePurge = async () => {
    if (!confirm('Are you sure you want to permanently delete ALL entries in the Dead Letter Queue? This action is irreversible.')) return;
    setPurging(true);
    try {
      // Custom route or API delete on jobs or metrics
      // In deadLetterQueue manager, we have purge(). We can create an endpoint or delete them manually.
      // Let's delete individual entries or we can clear them.
      for (const entry of entries) {
        await api.delete(`/jobs/${entry.originalJobId}`);
      }
      fetchDLQ();
    } catch (err: any) {
      alert(err.message || 'Failed to purge DLQ');
    } finally {
      setPurging(false);
    }
  };

  const handleViewDetails = (entry: DeadLetterEntry) => {
    setSelectedEntry(entry);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-rose-500 animate-spin" />
            <div className="absolute w-14 h-14 border border-rose-500/30 rounded-full animate-ping" />
          </div>
          <span className="text-rose-500/80 font-mono text-sm tracking-wider uppercase animate-pulse">Syncing DLQ Registry...</span>
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
            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider">Fault Registry</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">Dead Letter Queue</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <span>Dead Letter Queue (DLQ)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">Permanently failed jobs that have exhausted all configurable retry policies</p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={handlePurge}
            disabled={purging}
            className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-900/20 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition duration-300"
          >
            <Trash2 className="w-4 h-4" />
            <span>{purging ? 'Purging...' : 'Purge DLQ'}</span>
          </button>
        )}
      </div>

      {/* DLQ entries list */}
      {entries.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center border border-slate-800/80 max-w-lg mx-auto mt-12 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-emerald-400/80 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-200 mb-2 font-mono uppercase tracking-wider">DLQ is Clear</h3>
          <p className="text-xs text-slate-450 leading-relaxed font-sans">All background jobs completed successfully or are currently retrying. No permanent errors detected.</p>
        </div>
      ) : (
        <div className="glass rounded-3xl border border-slate-800/80 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400 font-bold uppercase tracking-wider bg-slate-950/40">
                  <th className="py-4 px-6">Job Name</th>
                  <th className="py-4 px-4">Queue</th>
                  <th className="py-4 px-4">Failure Reason</th>
                  <th className="py-4 px-4 text-center">Attempts</th>
                  <th className="py-4 px-4 text-right">Failed At</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {entries.map((entry) => (
                  <tr key={entry.id} className="text-slate-300 hover:bg-slate-900/20 transition-colors duration-200">
                    <td className="py-4 px-6 font-sans font-bold text-slate-200">
                      <button
                        onClick={() => handleViewDetails(entry)}
                        className="hover:text-cyan-400 transition text-left"
                      >
                        {entry.originalJob?.name || 'Unknown Job'}
                      </button>
                    </td>
                    <td className="py-4 px-4 text-slate-400">{entry.queue?.name || 'N/A'}</td>
                    <td className="py-4 px-4 text-rose-450 max-w-xs truncate">{entry.reason}</td>
                    <td className="py-4 px-4 text-center font-bold text-slate-400">{entry.retryCount}</td>
                    <td className="py-4 px-4 text-right text-slate-500">{new Date(entry.failedAt).toLocaleString()}</td>
                    <td className="py-4 px-6 text-right space-x-3 font-sans text-xs">
                      <button
                        onClick={() => handleRetry(entry)}
                        className="font-bold text-cyan-400 hover:text-cyan-300 transition"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => handleViewDetails(entry)}
                        className="font-bold text-slate-400 hover:text-slate-200 transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Inspect Modal */}
      {showDetailModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass rounded-3xl border border-slate-800/85 w-full max-w-2xl overflow-hidden relative shadow-[0_20px_50px_rgba(244,63,94,0.15)] my-8">
            <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-950/20">
              <div>
                <span className="text-[9px] text-rose-500 font-mono font-bold tracking-widest uppercase block mb-1">Queue ID: {selectedEntry.queueId}</span>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>DLQ Job inspection</span>
                </h2>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[58vh] overflow-y-auto custom-scrollbar font-mono text-xs">
              <div className="bg-slate-950/60 border border-slate-900/80 p-4 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Job Name:</span>
                  <span className="font-bold text-slate-200 font-sans">{selectedEntry.originalJob?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Failed Reason:</span>
                  <span className="font-bold text-rose-450">{selectedEntry.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Attempts:</span>
                  <span className="font-bold text-slate-200">{selectedEntry.retryCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Failed At:</span>
                  <span className="font-bold text-slate-200">{new Date(selectedEntry.failedAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedEntry.lastError && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Last Error Trace</h4>
                  <pre className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl text-[10px] text-rose-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {selectedEntry.lastError}
                  </pre>
                </div>
              )}

              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Original Payload</h4>
                <pre className="bg-slate-950 border border-slate-900/60 p-4 rounded-xl text-[11px] text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedEntry.originalPayload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800/60 flex justify-between items-center bg-slate-950/20">
              <span className="text-[10px] font-mono text-slate-500">Job ID: {selectedEntry.originalJobId}</span>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-350 border border-slate-800/85 px-4 py-2 rounded-xl text-xs font-bold uppercase transition"
                >
                  Close
                </button>
                <button
                  onClick={() => handleRetry(selectedEntry)}
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold uppercase transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[3px]" />
                  <span>Resubmit to Queue</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DLQ;
