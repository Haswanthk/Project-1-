import { useEffect, useState } from 'react'
import { Bell, Check, AlertTriangle, Info, AlertOctagon, RefreshCw } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { apiClient } from '../lib/api'

type Notification = {
  id: number
  title: string
  message: string
  severity: 'info' | 'warning' | 'error'
  timestamp: string
  read: boolean
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications/')
      setNotifications(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const handleMarkRead = async (id: number) => {
    try {
      await apiClient.post(`/notifications/${id}/read`)
      fetchNotifications()
    } catch (err) {
      console.error(err)
    }
  }

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'warning':
        return <AlertTriangle className="size-5 text-amber-400" />
      case 'error':
        return <AlertOctagon className="size-5 text-rose-400" />
      default:
        return <Info className="size-5 text-blue-400" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">System Notification Center</h2>
          <p className="text-sm text-slate-400">WebSocket real-time events, pipeline execution alerts, and model drift warnings</p>
        </div>
        <button onClick={fetchNotifications} className="flex items-center gap-2 rounded-xl bg-slate-800 border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
          <RefreshCw className="size-4" /> Refresh
        </button>
      </div>

      <GlassCard className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Bell className="size-5 text-violet-400" /> Notifications & Alerts
        </h3>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No notifications in inbox.</div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between p-4 rounded-xl border transition ${
                  n.read ? 'bg-slate-950/40 border-white/5 opacity-70' : 'bg-slate-900/80 border-violet-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 shrink-0">{getSeverityIcon(n.severity)}</div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">{n.title}</h4>
                    <p className="text-xs text-slate-300">{n.message}</p>
                    <p className="text-xs text-slate-500">{new Date(n.timestamp).toLocaleString()}</p>
                  </div>
                </div>

                {!n.read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="flex items-center gap-1 rounded-lg bg-violet-600/30 border border-violet-500/30 px-3 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-600/50 transition"
                  >
                    <Check className="size-3.5" /> Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
