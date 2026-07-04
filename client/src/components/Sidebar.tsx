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
    <aside className="w-64 bg-[#0a0f1e]/80 border-r border-slate-800 flex flex-col justify-between h-screen shrink-0 sticky top-0">
      <div className="flex flex-col">
        {/* Brand logo */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center glow-primary">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 leading-none">NOVA</h2>
            <span className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Distributed</span>
          </div>
        </div>

        {/* Navigation menu */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white glow-primary'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile & Logout */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            <User className="w-4 h-4 text-slate-300" />
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold text-slate-200 truncate leading-tight">{user?.name}</h4>
            <span className="text-[10px] text-slate-400 font-medium capitalize">{user?.role?.toLowerCase() || 'Member'}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
