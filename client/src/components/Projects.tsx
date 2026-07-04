import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Project } from '../types';
import { FolderKanban, Plus, Trash2, Calendar, FileText, RefreshCw, X } from 'lucide-react';

interface ProjectsProps {
  user: any;
}

export const Projects: React.FC<ProjectsProps> = ({ user }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      const res: any = await api.get('/projects');
      setProjects(res.data);
    } catch (err: any) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSubmitting(true);

    try {
      await api.post('/projects', {
        name,
        description: description || undefined,
        organizationId: user.organizationId,
      });
      setName('');
      setDescription('');
      setShowModal(false);
      fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? All associated queues and jobs will be deleted.')) return;
    try {
      await api.delete(`/projects/${id}`);
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
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
          <span className="text-cyan-400/80 font-mono text-sm tracking-wider uppercase animate-pulse">Accessing Workspaces...</span>
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
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Workspace Pools</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">Multi-Tenant Isolation</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Workspace Projects
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">Organize queues and jobs into distinct project workspaces</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition duration-300 shadow-lg shadow-cyan-500/10"
        >
          <Plus className="w-4 h-4 text-slate-950 stroke-[3px]" />
          <span>New Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center border border-slate-800/80 max-w-lg mx-auto mt-12 shadow-2xl">
          <FolderKanban className="w-12 h-12 text-cyan-400/70 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-200 mb-2 font-mono uppercase tracking-wider">No Projects Found</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed font-sans">Create a project workspace to configure your queues and background tasks.</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition duration-300"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="glass rounded-3xl p-6 border border-slate-800/80 flex flex-col justify-between hover:border-cyan-500/30 transition duration-300 group shadow-lg">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-100 text-lg group-hover:text-cyan-400 transition-colors duration-200">{project.name}</h3>
                  </div>
                  {user.role === 'ADMIN' && (
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-850 transition"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-6 line-clamp-3 min-h-[48px] leading-relaxed font-sans">{project.description || 'No description provided.'}</p>
              </div>

              <div className="border-t border-slate-800/40 pt-4 flex justify-between items-center text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>Queues: <span className="font-bold text-slate-200">{project._count?.queues ?? 0}</span></span>
                </span>
                <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                  ID: {project.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass rounded-3xl border border-slate-800/85 w-full max-w-md overflow-hidden relative shadow-[0_20px_50px_rgba(6,182,212,0.15)] my-8">
            <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-950/20">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span>Create Workspace Project</span>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="m-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-450 text-xs font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Project Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800/80 focus:border-cyan-500/50 rounded-xl py-2 px-3.5 text-xs font-mono text-slate-200 placeholder-slate-650 focus:outline-none transition duration-300"
                  placeholder="e.g. Core Billing"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-xs font-mono text-slate-200 placeholder-slate-650 focus:outline-none transition duration-300 h-24 resize-none"
                  placeholder="Describe the purpose of this project..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-slate-900 hover:bg-slate-855 text-slate-300 border border-slate-800/85 px-4 py-2 rounded-xl text-xs font-bold uppercase transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
