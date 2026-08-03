import { useState } from 'react'
import {
  Bell,
  LayoutDashboard,
  Settings,
  Upload,
  Table2,
  PlugZap,
  Folder,
  BarChart2,
  Cpu,
  Radio,
  Brain,
  Play,
  Target,
  ShieldCheck,
  Bot,
  FileText,
  Activity,
  User,
  ShieldAlert,
  LogOut,
  TrendingUp,
  AlertTriangle,
  LineChart,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../state/authStore'

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> }
type NavGroup = { group: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Analytics',
    items: [
      { to: '/dashboard',  label: 'Dashboard',        icon: LayoutDashboard },
      { to: '/analytics',  label: 'Business Analytics',icon: TrendingUp },
      { to: '/anomaly',    label: 'Anomaly Detection', icon: AlertTriangle },
      { to: '/forecast',   label: 'Forecasting',       icon: LineChart },
    ],
  },
  {
    group: 'Data',
    items: [
      { to: '/dataset-upload', label: 'Dataset Upload',  icon: Upload },
      { to: '/workspace',      label: 'Data Workspace',  icon: Table2 },
      { to: '/connectors',     label: 'Data Connectors', icon: PlugZap },
      { to: '/data-profiling', label: 'Data Profiling',  icon: BarChart2 },
      { to: '/projects',       label: 'Projects',        icon: Folder },
    ],
  },
  {
    group: 'Machine Learning',
    items: [
      { to: '/ml-models',      label: 'ML Models',       icon: Brain },
      { to: '/training',       label: 'Training',        icon: Play },
      { to: '/predictions',    label: 'Predictions',     icon: Target },
      { to: '/model-registry', label: 'Model Registry',  icon: ShieldCheck },
    ],
  },
  {
    group: 'Platform',
    items: [
      { to: '/streaming',      label: 'Streaming',       icon: Radio },
      { to: '/spark-jobs',     label: 'Spark Jobs',      icon: Cpu },
      { to: '/ai-assistant',   label: 'AI Assistant',    icon: Bot },
      { to: '/reports',        label: 'Reports',         icon: FileText },
      { to: '/monitoring',     label: 'Monitoring',      icon: Activity },
      { to: '/notifications',  label: 'Notifications',   icon: Bell },
      { to: '/settings',       label: 'Settings',        icon: Settings },
      { to: '/profile',        label: 'Profile',         icon: User },
      { to: '/admin',          label: 'Admin Panel',     icon: ShieldAlert },
    ],
  },
]

export function AppShell() {
  const clearAuth  = useAuthStore(state => state.clear)
  const navigate   = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const sidebarWidth = collapsed ? 'w-[60px]' : 'w-[256px]'

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-3 py-4 mb-2 ${collapsed ? 'justify-center' : ''}`}>
        <div className="p-2 rounded-xl bg-violet-600/25 border border-violet-500/30 text-violet-300 shrink-0">
          <LayoutDashboard className="size-4" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-xs font-bold text-white tracking-wide leading-tight">Unified Enterprise AI</h1>
            <p className="text-[10px] text-slate-500">Analytics Platform</p>
          </div>
        )}
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto space-y-5 px-2 pb-4">
        {NAV_GROUPS.map(group => (
          <div key={group.group}>
            {!collapsed && (
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-1">
                {group.group}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        isActive
                          ? 'bg-violet-600/25 text-violet-200 border border-violet-500/25 shadow-sm'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`mt-auto pt-3 border-t border-white/8 px-2 pb-3 space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[var(--c-bg-body)]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col ${sidebarWidth} shrink-0 border-r border-white/8 bg-slate-950/90 backdrop-blur-xl sticky top-0 h-screen overflow-hidden transition-all duration-200`}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-3.5 -right-3 w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10 shadow"
        >
          {collapsed ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
        </button>
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-slate-950 border-r border-white/10 p-0 overflow-y-auto z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/8 bg-slate-950/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-white">Enterprise Analytics Workspace</h2>
              <p className="text-[10px] text-slate-500">Production-grade orchestration, ML, and AI copilot</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live
            </div>
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition"
            >
              <Bell className="size-4" />
              <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-rose-500 animate-ping" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition"
            >
              <Settings className="size-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
