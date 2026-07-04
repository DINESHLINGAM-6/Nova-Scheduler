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
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#05070f]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-slate-400 text-sm">Loading projects...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#05070f] min-h-screen relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Projects
          </h1>
          <p className="text-sm text-slate-400">Organize queues and jobs into distinct project workspaces</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition glow-primary"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center border border-slate-800/80 max-w-lg mx-auto mt-12">
          <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-2">No Projects Found</h3>
          <p className="text-sm text-slate-400 mb-6">Create a project workspace to configure your queues and background tasks.</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="glass rounded-xl p-6 border border-slate-800/80 flex flex-col justify-between glass-hover group">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-200 text-lg group-hover:text-blue-400 transition-colors">{project.name}</h3>
                  </div>
                  {user.role === 'ADMIN' && (
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded hover:bg-slate-900 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-400 mb-6 line-clamp-3 min-h-[48px]">{project.description || 'No description provided.'}</p>
              </div>

              <div className="border-t border-slate-900 pt-4 flex justify-between items-center text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Queues: {project._count?.queues ?? 0}</span>
                </span>
                <span className="font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                  ID: {project.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-slate-800 w-full max-w-md overflow-hidden relative glow-primary">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-blue-500" />
                <span>Create Workspace Project</span>
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

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Project Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                  placeholder="e.g. Core Billing"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition h-24 resize-none"
                  placeholder="Describe the purpose of this project..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
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
