/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  UserSession, 
  Website, 
  Incident, 
  NotificationSettings, 
  WorkspaceSettings, 
  ViewType 
} from './types';
import { api } from './api';
import { usePersistentState } from './hooks/usePersistentState';

import Sidebar from './components/Sidebar';
import TopNavBar from './components/TopNavBar';
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import DetailsView from './components/DetailsView';
import IncidentsView from './components/IncidentsView';
import ReportsView from './components/ReportsView';
import NotificationsView from './components/NotificationsView';
import SettingsView from './components/SettingsView';

export default function App() {
  // App-level state, loaded from the real API
  const [user, setUser] = useState<UserSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [currentView, setCurrentView] = usePersistentState<ViewType>('current_view', 'dashboard');
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // On mount, check for an existing session and load domain data if present
  useEffect(() => {
    api.auth
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.websites.list().then(({ websites }) => setWebsites(websites));
    api.incidents.list().then(({ incidents }) => setIncidents(incidents));
    api.notifications.get().then(({ notifications }) => setNotifications(notifications));
    api.settings.get().then(({ settings }) => setSettings(settings));
  }, [user]);

  // Global keyboard shortcuts for navigation and search focusing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '/' to focus search
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      // 'Escape' to clear search or go back
      if (e.key === 'Escape') {
        setSearchQuery('');
        document.getElementById('global-search')?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Core State Mutators / Action Handlers ---

  const handleLoginSuccess = (session: UserSession) => {
    setUser(session);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setWebsites([]);
    setIncidents([]);
    setCurrentView('login');
  };

  const handleNavigateToView = (view: ViewType, extraData?: any) => {
    if (view === 'details' && extraData) {
      setSelectedWebsiteId(extraData);
    }
    setCurrentView(view);
    // Auto-scroll to top on transition
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddWebsite = async (newWeb: Omit<Website, 'id' | 'responseTimeHistory' | 'lastChecked'>) => {
    const { website } = await api.websites.create(newWeb);
    setWebsites([website, ...websites]);
  };

  const handleEditWebsite = async (updatedWeb: Website) => {
    const { website } = await api.websites.update(updatedWeb.id, updatedWeb);
    setWebsites(websites.map((w) => (w.id === website.id ? website : w)));
  };

  const handleDeleteWebsite = async (id: string) => {
    await api.websites.remove(id);
    setWebsites(websites.filter((w) => w.id !== id));
    setIncidents(incidents.filter((i) => i.websiteId !== id));
    if (selectedWebsiteId === id) {
      setSelectedWebsiteId(null);
      if (currentView === 'details') {
        setCurrentView('inventory');
      }
    }
  };

  const handleToggleStatus = async (id: string) => {
    const { website } = await api.websites.toggleStatus(id);
    setWebsites(websites.map((w) => (w.id === id ? website : w)));
  };

  const handleAcknowledgeIncident = async (id: string) => {
    const { incident } = await api.incidents.acknowledge(id);
    setIncidents(incidents.map((i) => (i.id === id ? incident : i)));
  };

  const handleResolveIncident = async (id: string) => {
    const { incident } = await api.incidents.resolve(id);
    setIncidents(incidents.map((i) => (i.id === id ? incident : i)));
    const { websites: refreshed } = await api.websites.list();
    setWebsites(refreshed);
  };

  // Clear query and open add modal
  const handleQuickAddTrigger = () => {
    setCurrentView('inventory');
    // Slight timeout to let the view render, then click the add site trigger
    setTimeout(() => {
      document.getElementById('btn-add-site')?.click();
    }, 100);
  };

  // Selected website element for details view
  const selectedWebsite = websites.find(w => w.id === selectedWebsiteId) || websites[0];

  // Route resolver helper
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            websites={websites}
            incidents={incidents}
            notifications={notifications!}
            onNavigateToView={handleNavigateToView}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onResolveIncident={handleResolveIncident}
          />
        );
      case 'inventory':
        return (
          <InventoryView
            websites={websites}
            onAddWebsite={handleAddWebsite}
            onEditWebsite={handleEditWebsite}
            onDeleteWebsite={handleDeleteWebsite}
            onToggleStatus={handleToggleStatus}
            onNavigateToDetails={(id) => handleNavigateToView('details', id)}
            searchQuery={searchQuery}
          />
        );
      case 'details':
        return (
          <DetailsView
            website={selectedWebsite}
            incidents={incidents}
            onBack={() => handleNavigateToView('inventory')}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onResolveIncident={handleResolveIncident}
          />
        );
      case 'incidents':
        return (
          <IncidentsView
            incidents={incidents}
            websites={websites}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onResolveIncident={handleResolveIncident}
          />
        );
      case 'reports':
        return (
          <ReportsView
            websites={websites}
            incidents={incidents}
          />
        );
      case 'notifications':
        return (
          <NotificationsView
            notifications={notifications!}
            onSaveNotifications={async (n) => {
              const { notifications: updated } = await api.notifications.update(n);
              setNotifications(updated);
            }}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings!}
            onSaveSettings={async (s) => {
              const { settings: updated } = await api.settings.update(s);
              setSettings(updated);
            }}
          />
        );
      default:
        return (
          <DashboardView
            websites={websites}
            incidents={incidents}
            notifications={notifications!}
            onNavigateToView={handleNavigateToView}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onResolveIncident={handleResolveIncident}
          />
        );
    }
  };

  // Render Login state first if user session is absent
  if (!authChecked) {
    return null;
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (!notifications || !settings) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800 flex">
      {/* Navigation Rails */}
      <Sidebar 
        currentView={currentView}
        onNavigate={(view) => handleNavigateToView(view)}
        user={user}
        onLogout={handleLogout}
        incidents={incidents}
      />

      {/* Main Page Area Container */}
      <div className="flex-1 pl-64 min-w-0">
        <TopNavBar 
          user={user}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onQuickAdd={handleQuickAddTrigger}
        />

        {/* Scrolling body offset for fixed top nav (16px bottom padding for bento look) */}
        <main className="pt-22 pb-12 px-8 max-w-7xl mx-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
