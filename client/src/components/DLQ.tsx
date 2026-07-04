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
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#05070f]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-slate-400 text-sm">Loading Dead Letter Queue...</span>
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
            <ShieldAlert className="w-8 h-8 text-red-500" />
            <span>Dead Letter Queue (DLQ)</span>
          </h1>
          <p className="text-sm text-slate-400">Permanently failed jobs that have exhausted all configurable retry policies</p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={handlePurge}
            disabled={purging}
            className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-900/20 px-4 py-2.5 rounded-lg text-sm font-semibold transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>{purging ? 'Purging...' : 'Purge DLQ'}</span>
          </button>
        )}
      </div>

      {/* DLQ entries list */}
      {entries.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center border border-slate-800/80 max-w-lg mx-auto mt-12">
          <AlertTriangle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-2">DLQ is Clear</h3>
          <p className="text-sm text-slate-400">All background jobs completed successfully or are currently retrying. No permanent errors detected.</p>
        </div>
      ) : (
        <div className="glass rounded-xl border border-slate-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider bg-slate-950/40">
                  <th className="py-3 px-6">Job Name</th>
                  <th className="py-3 px-4">Queue</th>
                  <th className="py-3 px-4">Failure Reason</th>
                  <th className="py-3 px-4 text-center">Attempts</th>
                  <th className="py-3 px-4 text-right">Failed At</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {entries.map((entry) => (
                  <tr key={entry.id} className="text-slate-300 hover:bg-slate-900/30 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-200">
                      <button
                        onClick={() => handleViewDetails(entry)}
                        className="hover:text-blue-400 text-left"
                      >
                        {entry.originalJob?.name || 'Unknown Job'}
                      </button>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">{entry.queue?.name || 'N/A'}</td>
                    <td className="py-4 px-4 text-xs text-red-400 max-w-xs truncate">{entry.reason}</td>
                    <td className="py-4 px-4 text-center font-mono text-xs">{entry.retryCount}</td>
                    <td className="py-4 px-4 text-right text-xs text-slate-500">{new Date(entry.failedAt).toLocaleString()}</td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleRetry(entry)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => handleViewDetails(entry)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-200 transition"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-slate-800 w-full max-w-2xl overflow-hidden relative glow-primary">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-red-400 font-semibold tracking-wider uppercase block mb-1">Queue ID: {selectedEntry.queueId}</span>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>DLQ Job inspection</span>
                </h2>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Job Name:</span>
                  <span className="font-semibold text-slate-200">{selectedEntry.originalJob?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Failed Reason:</span>
                  <span className="font-semibold text-red-400">{selectedEntry.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Attempts:</span>
                  <span className="font-semibold font-mono text-slate-200">{selectedEntry.retryCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Failed At:</span>
                  <span className="font-semibold text-slate-200">{new Date(selectedEntry.failedAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedEntry.lastError && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Last Error Trace</h4>
                  <pre className="bg-red-950/20 border border-red-950 p-4 rounded-lg text-[10px] font-mono text-red-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {selectedEntry.lastError}
                  </pre>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Original Payload</h4>
                <pre className="bg-slate-950 border border-slate-900 p-4 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedEntry.originalPayload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-between items-center bg-slate-950/20">
              <span className="text-xs font-mono text-slate-500">Job ID: {selectedEntry.originalJobId}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-lg text-xs font-semibold transition"
                >
                  Close
                </button>
                <button
                  onClick={() => handleRetry(selectedEntry)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
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
