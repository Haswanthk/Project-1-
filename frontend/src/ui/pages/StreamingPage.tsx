import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { Radio, Zap, Users, Activity } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton, ChartSkeleton } from '../components/ui/LoadingSkeleton'
import { StatusBadge } from '../components/ui/StatusBadge'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function StreamingPage() {
  const [summary, setSummary] = useState<any>(null)
  const [topics, setTopics] = useState<any[]>([])
  const [throughput, setThroughput] = useState<any>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const [s, t, tp, g] = await Promise.allSettled([
      apiClient.get('/streaming/summary'), apiClient.get('/streaming/topics'),
      apiClient.get('/streaming/throughput'), apiClient.get('/streaming/consumer-groups'),
    ])
    if (s.status === 'fulfilled') setSummary(s.value.data)
    if (t.status === 'fulfilled') setTopics(t.value.data)
    if (tp.status === 'fulfilled') setThroughput(tp.value.data)
    if (g.status === 'fulfilled') setGroups(g.value.data)
    setLoading(false)
  }

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 15000); return () => clearInterval(iv) }, [])

  const throughputChart = throughput ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, backgroundColor: '#0f172a', borderColor: '#1e293b', textStyle: { color: '#e2e8f0' } },
    grid: { top: 20, bottom: 30, left: 50, right: 20 },
    xAxis: { type: 'category' as const, data: throughput.timestamps || throughput.map?.((_: any, i: number) => `T-${60 - i}`), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value' as const, name: 'Events/sec', nameTextStyle: { color: '#64748b' }, axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{ data: throughput.values || throughput.map?.((t: any) => t.events_per_second), type: 'line' as const, smooth: true, symbol: 'none',
      lineStyle: { color: '#06b6d4', width: 2.5 },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(6,182,212,0.25)' }, { offset: 1, color: 'rgba(6,182,212,0)' }] } },
    }],
  } : null

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Streaming" subtitle="Real-time event streaming and Kafka topic monitoring" icon={<Radio className="size-6" />} />

      {loading ? <CardSkeleton /> : summary && (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Topics', value: summary.active_topics ?? topics.length, icon: <Radio className="size-5 text-cyan-400" />, gradient: 'from-cyan-500/15 to-cyan-600/5' },
            { label: 'Events/sec', value: summary.events_per_second ?? summary.total_events_per_sec, icon: <Zap className="size-5 text-amber-400" />, gradient: 'from-amber-500/15 to-amber-600/5' },
            { label: 'Consumer Groups', value: summary.consumer_groups ?? groups.length, icon: <Users className="size-5 text-violet-400" />, gradient: 'from-violet-500/15 to-violet-600/5' },
            { label: 'Total Events (24h)', value: summary.total_events_24h?.toLocaleString() ?? '—', icon: <Activity className="size-5 text-emerald-400" />, gradient: 'from-emerald-500/15 to-emerald-600/5' },
          ].map(c => (
            <motion.div key={c.label} variants={fadeUp} className="stat-card p-5">
              <div className="flex items-center gap-3 mb-3"><div className={`p-2 rounded-xl bg-gradient-to-br ${c.gradient}`}>{c.icon}</div><span className="text-xs font-medium text-[var(--c-text-secondary)]">{c.label}</span></div>
              <p className="text-2xl font-bold tracking-tight">{c.value}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Throughput */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">Throughput (Real-time)</h3>
        {loading || !throughputChart ? <ChartSkeleton /> : <ReactECharts option={throughputChart} style={{ height: 300 }} />}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Topics */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Topics</h3>
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
            {topics.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-bg-body)]/50 border border-[var(--c-border)]">
                <div><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-[var(--c-text-muted)]">{t.partitions} partitions</p></div>
                <div className="text-right"><p className="text-sm font-semibold text-cyan-400">{t.messages_per_sec}/s</p><StatusBadge label={t.status || 'active'} variant="success" /></div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Consumer Groups */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Consumer Groups</h3>
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
            {groups.map((g: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-bg-body)]/50 border border-[var(--c-border)]">
                <div><p className="text-sm font-medium">{g.name}</p><p className="text-xs text-[var(--c-text-muted)]">{g.members} members</p></div>
                <div className="text-right"><p className={`text-sm font-semibold ${g.lag > 100 ? 'text-amber-400' : 'text-emerald-400'}`}>Lag: {g.lag}</p><StatusBadge label={g.state || g.status || 'stable'} variant={g.lag > 100 ? 'warning' : 'success'} /></div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
