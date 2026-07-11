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
import {
  INITIAL_WEBSITES,
  INITIAL_INCIDENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_WORKSPACE_SETTINGS,
  DEFAULT_USER
} from './data';
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
  // App-level state, persisted to localStorage on every change
  const [user, setUser] = usePersistentState<UserSession | null>('user_session', null);
  const [websites, setWebsites] = usePersistentState<Website[]>('websites', INITIAL_WEBSITES);
  const [incidents, setIncidents] = usePersistentState<Incident[]>('incidents', INITIAL_INCIDENTS);
  const [notifications, setNotifications] = usePersistentState<NotificationSettings>('notifications', INITIAL_NOTIFICATIONS);
  const [settings, setSettings] = usePersistentState<WorkspaceSettings>('settings', INITIAL_WORKSPACE_SETTINGS);
  const [currentView, setCurrentView] = usePersistentState<ViewType>('current_view', 'dashboard');
  const [selectedWebsiteId, setSelectedWebsiteId] = usePersistentState<string | null>('selected_website_id', null);

  const [searchQuery, setSearchQuery] = useState('');

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

  const handleLogout = () => {
    setUser(null);
    setCurrentView('login');
    // Keep websites and settings, but clear active session
  };

  const handleNavigateToView = (view: ViewType, extraData?: any) => {
    if (view === 'details' && extraData) {
      setSelectedWebsiteId(extraData);
    }
    setCurrentView(view);
    // Auto-scroll to top on transition
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. Add Website
  const handleAddWebsite = (newWeb: Omit<Website, 'id' | 'responseTimeHistory' | 'lastChecked'>) => {
    const id = `web-${Date.now()}`;
    const baseLatency = newWeb.responseTime || 120;
    
    // Prepopulate past 24 hours of response time history
    const history = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const variance = (Math.random() - 0.5) * (baseLatency * 0.15);
      history.push({ timestamp: label, value: Math.max(10, Math.round(baseLatency + variance)) });
    }

    const website: Website = {
      ...newWeb,
      id,
      responseTimeHistory: history,
      lastChecked: new Date().toISOString()
    };

    setWebsites([website, ...websites]);
  };

  // 2. Edit Website
  const handleEditWebsite = (updatedWeb: Website) => {
    setWebsites(websites.map(w => w.id === updatedWeb.id ? updatedWeb : w));
  };

  // 3. Delete Website
  const handleDeleteWebsite = (id: string) => {
    setWebsites(websites.filter(w => w.id !== id));
    // Clear related incidents
    setIncidents(incidents.filter(i => i.websiteId !== id));
    if (selectedWebsiteId === id) {
      setSelectedWebsiteId(null);
      if (currentView === 'details') {
        setCurrentView('inventory');
      }
    }
  };

  // 4. Toggle Monitoring State (Pause/Resume)
  const handleToggleStatus = (id: string) => {
    setWebsites(websites.map(w => {
      if (w.id === id) {
        const nextStatus = w.status === 'maintenance' ? 'up' : 'maintenance';
        // If resuming, restore normal response time, else set to 0
        const nextResponse = nextStatus === 'maintenance' ? 0 : 120;
        return { 
          ...w, 
          status: nextStatus,
          responseTime: nextResponse
        };
      }
      return w;
    }));
  };

  // 5. Acknowledge Incident
  const handleAcknowledgeIncident = (id: string) => {
    setIncidents(incidents.map(inc => {
      if (inc.id === id) {
        return {
          ...inc,
          status: 'acknowledged',
          acknowledgedAt: new Date().toISOString()
        };
      }
      return inc;
    }));
  };

  // 6. Resolve Incident
  const handleResolveIncident = (id: string) => {
    let targetWebsiteId = '';
    
    setIncidents(incidents.map(inc => {
      if (inc.id === id) {
        targetWebsiteId = inc.websiteId;
        return {
          ...inc,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
          duration: '12m' // mock duration
        };
      }
      return inc;
    }));

    // Instantly "repair" the crashed website back to normal UP status and restore standard speed
    if (targetWebsiteId) {
      setWebsites(prevWebsites => 
        prevWebsites.map(w => {
          if (w.id === targetWebsiteId) {
            return {
              ...w,
              status: 'up',
              responseTime: 110, // normal baseline
              // Make sure we clear 0s from tail of history
              responseTimeHistory: w.responseTimeHistory.map((h, idx) => 
                idx === w.responseTimeHistory.length - 1 && h.value === 0 
                  ? { ...h, value: 110 } 
                  : h
              )
            };
          }
          return w;
        })
      );
    }
  };

  // 7. Inject Incident (Playground Crash simulation)
  const handleInjectIncident = (
    websiteId: string, 
    title: string, 
    severity: 'critical' | 'warning', 
    description: string
  ) => {
    const web = websites.find(w => w.id === websiteId);
    if (!web) return;

    const newIncident: Incident = {
      id: `inc-${Date.now()}`,
      websiteId,
      websiteName: web.name,
      title,
      severity,
      status: 'active',
      createdAt: new Date().toISOString(),
      description
    };

    setIncidents([newIncident, ...incidents]);

    // Crash the website: set status and mock latency to 0 (down) or high (degraded)
    setWebsites(prevWebsites => 
      prevWebsites.map(w => {
        if (w.id === websiteId) {
          const nextStatus = severity === 'critical' ? 'down' : 'degraded';
          const nextResponseTime = severity === 'critical' ? 0 : 450;
          
          // Append crash metric to response history
          const history = [...w.responseTimeHistory];
          if (history.length > 0) {
            history[history.length - 1] = { 
              ...history[history.length - 1], 
              value: nextResponseTime 
            };
          }

          return {
            ...w,
            status: nextStatus,
            responseTime: nextResponseTime,
            responseTimeHistory: history
          };
        }
        return w;
      })
    );
  };

  // 8. Manual Diagnostic ping checking
  const handleTriggerPingTest = (id: string) => {
    setWebsites(prevWebsites => 
      prevWebsites.map(w => {
        if (w.id === id) {
          const base = w.status === 'down' ? 0 : w.responseTime || 120;
          const variance = w.status === 'down' ? 0 : (Math.random() - 0.5) * (base * 0.1);
          const val = Math.max(0, Math.round(base + variance));
          
          const nextHistory = [...w.responseTimeHistory];
          if (nextHistory.length > 0) {
            nextHistory[nextHistory.length - 1] = {
              ...nextHistory[nextHistory.length - 1],
              value: val
            };
          }

          return {
            ...w,
            responseTime: val,
            responseTimeHistory: nextHistory,
            lastChecked: new Date().toISOString()
          };
        }
        return w;
      })
    );
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
            notifications={notifications}
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
            onTriggerPingTest={handleTriggerPingTest}
          />
        );
      case 'incidents':
        return (
          <IncidentsView
            incidents={incidents}
            websites={websites}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onResolveIncident={handleResolveIncident}
            onInjectIncident={handleInjectIncident}
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
            notifications={notifications}
            onSaveNotifications={setNotifications}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            onSaveSettings={setSettings}
          />
        );
      default:
        return (
          <DashboardView
            websites={websites}
            incidents={incidents}
            notifications={notifications}
            onNavigateToView={handleNavigateToView}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onResolveIncident={handleResolveIncident}
          />
        );
    }
  };

  // Render Login state first if user session is absent
  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
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
