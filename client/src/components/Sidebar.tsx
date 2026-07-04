import React from 'react';
import {
  Activity,
  FolderKanban,
  Layers,
  Cpu,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  User
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, user, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'queues', label: 'Queues', icon: Layers },
    { id: 'jobs', label: 'Jobs & Triggers', icon: Activity },
    { id: 'workers', label: 'Workers', icon: Cpu },
    { id: 'dlq', label: 'Dead Letter Queue', icon: AlertTriangle },
  ];

  return (
    <aside className="w-64 bg-slate-950/60 backdrop-blur-xl border-r border-slate-800/80 flex flex-col justify-between h-screen shrink-0 sticky top-0 z-20">
      <div className="flex flex-col">
        {/* Brand logo */}
        <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent leading-none">
              NOVA
            </h2>
            <span className="text-[9px] text-cyan-400/80 font-bold tracking-[0.2em] uppercase">SCHEDULER</span>
          </div>
        </div>

        {/* Navigation menu */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/5 text-cyan-400 border-l-2 border-cyan-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/30'
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile & Logout */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 space-y-3">
        {/* Live sync telemetries indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-slate-800/40 text-[10px] font-mono text-cyan-400/90 font-bold uppercase tracking-wider">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Live Telemetry Connected</span>
        </div>

        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center text-slate-300 font-semibold shadow-inner">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-bold text-slate-200 truncate leading-tight">{user?.name}</h4>
            <span className="text-[9px] text-slate-400 font-mono capitalize">{user?.role?.toLowerCase() || 'Member'}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all duration-300 border border-transparent hover:border-red-950/40"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
