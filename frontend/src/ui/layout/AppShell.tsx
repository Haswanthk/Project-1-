import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Search,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../state/authStore'

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> }
type NavGroup = { group: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Analytics',
    items: [
      { to: '/dashboard',  label: 'Dashboard',         icon: LayoutDashboard },
      { to: '/analytics',  label: 'Business Analytics', icon: TrendingUp },
      { to: '/anomaly',    label: 'Anomaly Detection',  icon: AlertTriangle },
      { to: '/forecast',   label: 'Forecasting',        icon: LineChart },
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
  const user       = useAuthStore(state => state.user)
  const navigate   = useNavigate()
  const location   = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const NavItemLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon
    return (
      <NavLink
        to={item.to}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
            collapsed ? 'justify-center' : ''
          } ${
            isActive
              ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-white border border-indigo-500/20 shadow-sm shadow-indigo-500/10'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
          }`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.div
                layoutId="nav-active-pill"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-indigo-400"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <Icon className="size-[18px] shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        )}
      </NavLink>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center' : ''}`}>
        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-600/30 to-violet-600/20 border border-indigo-500/25 text-indigo-300 shrink-0">
          <LayoutDashboard className="size-5" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight whitespace-nowrap">Enterprise AI</h1>
              <p className="text-[10px] text-slate-500 whitespace-nowrap">Analytics Platform</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 mb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-500 text-xs">
            <Search className="size-3.5" />
            <span>Search...</span>
            <kbd className="ml-auto px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono text-slate-600">⌘K</kbd>
          </div>
        </div>
      )}

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto space-y-5 px-2.5 pb-4">
        {NAV_GROUPS.map(group => (
          <div key={group.group}>
            {!collapsed && (
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.12em] px-3 mb-2">
                {group.group}
              </p>
            )}
            {collapsed && <div className="h-px bg-white/[0.04] my-2" />}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItemLink key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className={`mt-auto pt-3 border-t border-white/[0.06] px-3 pb-4 space-y-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/[0.03] mb-2">
            <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.full_name || 'User'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email || ''}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
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
      <motion.aside
        animate={{ width: collapsed ? 68 : 260 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="hidden md:flex flex-col shrink-0 border-r border-white/[0.06] bg-[#060B18]/95 backdrop-blur-2xl sticky top-0 h-screen overflow-hidden"
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-5 -right-3 w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all duration-200 z-10 shadow-lg"
        >
          {collapsed ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
        </button>
      </motion.aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-[260px] h-full bg-[#060B18] border-r border-white/[0.06] z-50 overflow-y-auto"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition z-10"
              >
                <X className="size-4" />
              </button>
              <SidebarContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[var(--c-bg-body)]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-white tracking-tight">Enterprise Analytics Workspace</h2>
              <p className="text-[11px] text-slate-500">Production-grade orchestration, ML, and AI copilot</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/15">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-400" />
              </span>
              Live
            </div>
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
            >
              <Bell className="size-[18px]" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 border border-[var(--c-bg-body)]" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
            >
              <Settings className="size-[18px]" />
            </button>
            {user && (
              <button
                onClick={() => navigate('/profile')}
                className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all ml-1"
              >
                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </button>
            )}
          </div>
        </header>

        {/* Page content with transitions */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
