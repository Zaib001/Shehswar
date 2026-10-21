'use client';

/**
 * SHEHSWAR ONE360 - Enterprise App Shell
 *
 * Unified layout wrapping Sidebar, TopHeader, CommandMenu, and page container.
 */
import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { CommandMenu } from './CommandMenu';

export interface AppShellProps {
  children: React.ReactNode;
  activeRoute?: string;
  onNavigate?: (route: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeRoute = 'dashboard',
  onNavigate,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(activeRoute);

  // Sync route
  useEffect(() => {
    if (activeRoute) {
      setCurrentRoute(activeRoute);
    }
  }, [activeRoute]);

  // Responsive sidebar collapse on tablet / smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && window.innerWidth >= 768) {
        setIsSidebarCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setIsSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigate = (routeId: string) => {
    setCurrentRoute(routeId);
    onNavigate?.(routeId);
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeRoute={currentRoute}
        onNavigate={handleNavigate}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main App Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <TopHeader
          onToggleSidebar={() => {
            if (window.innerWidth < 768) {
              setIsMobileMenuOpen(!isMobileMenuOpen);
            } else {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }
          }}
          onOpenCommandMenu={() => setIsCommandMenuOpen(true)}
        />

        {/* Page Content Canvas */}
        <main
          style={{
            flex: 1,
            padding: 'var(--space-lg)',
            overflowY: 'auto',
            overflowX: 'hidden',
            maxWidth: '1600px',
            width: '100%',
            margin: '0 auto',
          }}
        >
          {children}
        </main>
      </div>

      {/* Global Command Menu / Spotlight Search (Ctrl+K) */}
      <CommandMenu
        isOpen={isCommandMenuOpen}
        onClose={() => setIsCommandMenuOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  );
};
