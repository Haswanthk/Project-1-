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
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../state/authStore'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dataset-upload', label: 'Dataset Upload', icon: Upload },
  { to: '/workspace', label: 'Data Workspace', icon: Table2 },
  { to: '/connectors', label: 'Data Connectors', icon: PlugZap },
  { to: '/projects', label: 'Projects', icon: Folder },
  { to: '/data-profiling', label: 'Data Profiling', icon: BarChart2 },
  { to: '/spark-jobs', label: 'Spark Jobs', icon: Cpu },
  { to: '/streaming', label: 'Streaming', icon: Radio },
  { to: '/ml-models', label: 'ML Models', icon: Brain },
  { to: '/training', label: 'Training', icon: Play },
  { to: '/predictions', label: 'Predictions', icon: Target },
  { to: '/model-registry', label: 'Model Registry', icon: ShieldCheck },
  { to: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/monitoring', label: 'Monitoring', icon: Activity },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/admin', label: 'Admin Panel', icon: ShieldAlert },
]

export function AppShell() {
  const clearAuth = useAuthStore((state) => state.clear)
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr] bg-slate-950 text-slate-100 font-sans">
      <aside className="border-r border-white/10 bg-slate-950/80 p-5 backdrop-blur-xl flex flex-col justify-between h-screen sticky top-0 overflow-y-auto">
        <div>
          <div className="mb-6 flex items-center gap-3 px-2">
            <div className="p-2 rounded-xl bg-violet-600/30 border border-violet-500/40 text-violet-300">
              <LayoutDashboard className="size-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Unified Enterprise AI</h1>
              <p className="text-xs text-slate-400">Production Platform</p>
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'bg-violet-600/30 text-violet-100 border border-violet-500/30 font-semibold shadow-lg shadow-violet-950/50'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/10 mt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
          >
            <LogOut className="size-4" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="p-6 overflow-y-auto max-w-7xl mx-auto w-full">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <div>
            <h2 className="text-xl font-bold text-white">Enterprise Analytics Workspace</h2>
            <p className="text-xs text-slate-400">Production-grade orchestration, ML, and AI copilot</p>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <button onClick={() => navigate('/notifications')} className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition">
              <Bell className="size-5" />
              <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500 animate-ping" />
            </button>
            <button onClick={() => navigate('/settings')} className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition">
              <Settings className="size-5" />
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
