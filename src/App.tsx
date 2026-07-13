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
  UserRole,
  ViewType
} from './types';
import { api, AdminUser } from './api';
import { usePersistentState } from './hooks/usePersistentState';

import Sidebar from './components/Sidebar';
import TopNavBar from './components/TopNavBar';
import LoginView from './components/LoginView';
import ResetPasswordView from './components/ResetPasswordView';
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
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<{ timestamp: string; value: number }[]>([]);
  const [currentView, setCurrentView] = usePersistentState<ViewType>('current_view', 'dashboard');
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);

  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken'));
  const [resetTokenConsumed, setResetTokenConsumed] = useState(false);

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

    const loadDomainData = () => {
      api.websites.list().then(({ websites }) => setWebsites(websites));
      api.incidents.list().then(({ incidents }) => setIncidents(incidents));
      api.websites.latencyHistory().then(({ points }) => setLatencyHistory(points));
    };

    loadDomainData();
    api.notifications.get().then(({ notifications }) => setNotifications(notifications));
    api.settings.get().then(({ settings }) => setSettings(settings));
    api.admin.listUsers().then(({ users }) => setAdminUsers(users)).catch(() => setAdminUsers([]));

    // Poll for websites/incidents so status changes from the backend's
    // uptime-check cron show up without a manual page reload.
    const pollId = setInterval(loadDomainData, 30000);
    return () => clearInterval(pollId);
  }, [user]);

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

  const handleUpdateAvatar = async (avatarUrl: string) => {
    const { user: updated } = await api.auth.updateAvatar(avatarUrl);
    setUser(updated);
  };

  const handleNavigateToView = (view: ViewType, extraData?: any) => {
    if (view === 'details' && extraData) {
      setSelectedWebsiteId(extraData);
    }
    setCurrentView(view);
    // Auto-scroll to top on transition
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddWebsite = async (newWeb: Pick<Website, 'name' | 'url' | 'checkInterval' | 'tags'>) => {
    const { website } = await api.websites.create(newWeb);
    setWebsites([website, ...websites]);
  };

  const handleEditWebsite = async (updatedWeb: Pick<Website, 'id' | 'name' | 'url' | 'checkInterval' | 'tags'>) => {
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
    // The backend runs a real check as part of resolving, which can open a fresh incident
    // immediately if the site is still actually broken — refresh both lists to reflect that.
    await api.incidents.resolve(id);
    const [{ incidents: refreshedIncidents }, { websites: refreshedWebsites }] = await Promise.all([
      api.incidents.list(),
      api.websites.list(),
    ]);
    setIncidents(refreshedIncidents);
    setWebsites(refreshedWebsites);
  };

  const handleAddUser = async (data: { email: string; username: string; role: UserRole }) => {
    const { user: newUser, temporaryPassword, emailSent } = await api.admin.createUser(data);
    setAdminUsers([...adminUsers, newUser]);
    return { temporaryPassword, emailSent };
  };

  const handleUpdateUser = async (id: string, data: Partial<{ username: string; role: UserRole }>) => {
    const { user: updated } = await api.admin.updateUser(id, data);
    setAdminUsers(adminUsers.map((u) => (u.id === id ? updated : u)));
    // Editing yourself changes what the sidebar/session should show — keep it in sync.
    if (user && id === user.id) {
      setUser({ ...user, username: updated.username, role: updated.role });
    }
  };

  const handleRemoveUser = async (id: string) => {
    await api.admin.removeUser(id);
    setAdminUsers(adminUsers.filter((u) => u.id !== id));
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
            latencyHistory={latencyHistory}
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
          <ReportsView companyName={settings?.companyName ?? ''} />
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
            users={adminUsers}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onRemoveUser={handleRemoveUser}
            currentUserId={user.id}
            user={user}
            onMfaSetup={api.auth.mfaSetup}
            onMfaVerifySetup={async (token) => {
              await api.auth.mfaVerifySetup(token);
              setUser({ ...user, mfaEnabled: true });
            }}
            onMfaDisable={async (token) => {
              await api.auth.mfaDisable(token);
              setUser({ ...user, mfaEnabled: false });
            }}
          />
        );
      default:
        return (
          <DashboardView
            websites={websites}
            incidents={incidents}
            notifications={notifications!}
            latencyHistory={latencyHistory}
            onNavigateToView={handleNavigateToView}
            onAcknowledgeIncident={handleAcknowledgeIncident}
            onResolveIncident={handleResolveIncident}
          />
        );
    }
  };

  // A password-reset link takes priority over everything else — works whether or not
  // there's an existing session, and doesn't need the auth check to resolve first.
  if (resetToken && !resetTokenConsumed) {
    return (
      <ResetPasswordView
        token={resetToken}
        onDone={() => {
          setResetTokenConsumed(true);
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

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
        onUpdateAvatar={handleUpdateAvatar}
        incidents={incidents}
      />

      {/* Main Page Area Container */}
      <div className="flex-1 pl-64 min-w-0">
        <TopNavBar
          user={user}
          onQuickAdd={handleQuickAddTrigger}
          totalWebsites={websites.length}
          upWebsites={websites.filter((w) => w.status === 'up').length}
          criticalIncidents={incidents.filter((i) => i.status !== 'resolved' && i.severity === 'critical').length}
          warningIncidents={incidents.filter((i) => i.status !== 'resolved' && i.severity === 'warning').length}
        />

        {/* Scrolling body offset for fixed top nav (16px bottom padding for bento look) */}
        <main className="pt-22 pb-12 px-8 max-w-7xl mx-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
