import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Projects } from './components/Projects';
import { Queues } from './components/Queues';
import { Jobs } from './components/Jobs';
import { Workers } from './components/Workers';
import { DLQ } from './components/DLQ';
import socketService from './services/socket';

export const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount
    const savedToken = localStorage.getItem('nova_token');
    const savedUser = localStorage.getItem('nova_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        socketService.connect(savedToken);
      } catch (e) {
        console.error('Failed to parse user session:', e);
        localStorage.removeItem('nova_token');
        localStorage.removeItem('nova_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData: any, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('nova_token', userToken);
    localStorage.setItem('nova_user', JSON.stringify(userData));
    socketService.connect(userToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('nova_token');
    localStorage.removeItem('nova_user');
    socketService.disconnect();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05070f]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'projects':
        return <Projects user={user} />;
      case 'queues':
        return <Queues user={user} />;
      case 'jobs':
        return <Jobs user={user} />;
      case 'workers':
        return <Workers />;
      case 'dlq':
        return <DLQ />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex bg-[#05070f] text-slate-100 min-h-screen">
      {/* Sidebar navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main content container */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
