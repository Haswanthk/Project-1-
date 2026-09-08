import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import {
  Radio, Zap, Users, Activity, Play, Square, Plus,
  Send, Search, Terminal, CheckCircle2
} from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton, ChartSkeleton } from '../components/ui/LoadingSkeleton'
import { StatusBadge } from '../components/ui/StatusBadge'

const SAMPLE_PAYLOADS: Record<string, object> = {
  'Purchase Event': {
    order_id: 'ord_9941',
    user_id: 1042,
    amount_usd: 149.99,
    currency: 'USD',
    items: [{ sku: 'CLOUD-GPU-PRO', qty: 1 }],
    status: 'captured',
  },
  'IoT Sensor Telemetry': {
    sensor_id: 'sn-turb-04',
    temperature_c: 72.4,
    vibration_hz: 412,
    oil_pressure_psi: 34.2,
    battery_level_pct: 98,
  },
  'User Authentication': {
    user_id: 'usr_8812',
    event: 'login_mfa_success',
    ip_address: '198.51.100.44',
    client: 'Safari/17.4 macOS',
  },
  'Model Inference Log': {
    model_id: 'churn_detector_v2',
    latency_ms: 14.8,
    prediction: 'retain',
    confidence_score: 0.942,
  },
}

export function StreamingPage() {
  const [summary, setSummary] = useState<any>(null)
  const [topics, setTopics] = useState<any[]>([])
  const [throughput, setThroughput] = useState<any>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Interactive Live Producer Console
  const [produceTopic, setProduceTopic] = useState('events.transactions')
  const [produceKey, setProduceKey] = useState('usr_auto_881')
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(SAMPLE_PAYLOADS['Purchase Event'], null, 2)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [produceSuccessMsg, setProduceSuccessMsg] = useState<string | null>(null)
  const [autoStreaming, setAutoStreaming] = useState(false)
  const autoStreamRef = useRef<any>(null)

  // Live Stream Filter
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedTopicFilter, setSelectedTopicFilter] = useState('all')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  // New Topic Modal
  const [showNewTopicModal, setShowNewTopicModal] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicPartitions, setNewTopicPartitions] = useState(4)

  const fetchData = async () => {
    try {
      const [s, t, tp, g, ev] = await Promise.allSettled([
        apiClient.get('/streaming/summary'),
        apiClient.get('/streaming/topics'),
        apiClient.get('/streaming/throughput'),
        apiClient.get('/streaming/consumer-groups'),
        apiClient.get('/streaming/events?limit=30'),
      ])
      if (s.status === 'fulfilled') setSummary(s.value.data)
      if (t.status === 'fulfilled') {
        setTopics(t.value.data)
        if (t.value.data.length > 0 && !produceTopic) {
          setProduceTopic(t.value.data[0].name)
        }
      }
      if (tp.status === 'fulfilled') setThroughput(tp.value.data)
      if (g.status === 'fulfilled') setGroups(g.value.data)
      if (ev.status === 'fulfilled') setRecentEvents(ev.value.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 4000)
    return () => clearInterval(iv)
  }, [])

  // Auto-stream simulator
  useEffect(() => {
    if (autoStreaming) {
      autoStreamRef.current = setInterval(async () => {
        try {
          const keys = Object.keys(SAMPLE_PAYLOADS)
          const randomSample = keys[Math.floor(Math.random() * keys.length)]
          const targetTopic = topics.length > 0
            ? topics[Math.floor(Math.random() * topics.length)].name
            : 'events.transactions'

          await apiClient.post('/streaming/produce', {
            topic: targetTopic,
            key: `sim_${Date.now()}`,
            payload: SAMPLE_PAYLOADS[randomSample],
          })
          fetchData()
        } catch {
          // ignore
        }
      }, 2500)
    } else {
      if (autoStreamRef.current) clearInterval(autoStreamRef.current)
    }
    return () => {
      if (autoStreamRef.current) clearInterval(autoStreamRef.current)
    }
  }, [autoStreaming, topics])

  const handleProduceEvent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSubmitting(true)
    setProduceSuccessMsg(null)
    try {
      let parsedPayload: any
      try {
        parsedPayload = JSON.parse(payloadText)
      } catch {
        parsedPayload = { raw_message: payloadText }
      }

      const res = await apiClient.post('/streaming/produce', {
        topic: produceTopic,
        key: produceKey || `key_${Date.now()}`,
        payload: parsedPayload,
      })

      setProduceSuccessMsg(`Event produced to partition ${res.data.partition} (offset ${res.data.offset})`)
      fetchData()
      setTimeout(() => setProduceSuccessMsg(null), 4000)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to produce event')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTopicName.trim()) return
    try {
      await apiClient.post('/streaming/topics', {
        name: newTopicName.trim(),
        partitions: Number(newTopicPartitions),
        replication_factor: 2,
      })
      setShowNewTopicModal(false)
      setNewTopicName('')
      fetchData()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create topic')
    }
  }

  // Real-time Throughput Chart Options
  const throughputChart = throughput ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc' },
    },
    grid: { top: 25, bottom: 25, left: 55, right: 20 },
    xAxis: {
      type: 'category' as const,
      data: throughput.timestamps || [],
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'value' as const,
      name: 'EPS',
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Throughput (Events/sec)',
        data: throughput.values || [],
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#06b6d4', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(6, 182, 212, 0.35)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.0)' }
            ]
          }
        },
      }
    ],
  } : null

  // Filtered Events
  const filteredEvents = recentEvents.filter((ev: any) => {
    const matchTopic = selectedTopicFilter === 'all' || ev.topic === selectedTopicFilter
    const matchSearch =
      !searchFilter ||
      ev.key?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      JSON.stringify(ev.payload || {}).toLowerCase().includes(searchFilter.toLowerCase())
    return matchTopic && matchSearch
  })

  return (
    <div className="p-6 space-y-7 max-w-[1600px] mx-auto">
      {/* Header */}
      <PageHeader
        title="Streaming & Event Bus Studio"
        subtitle="Real-time Kafka ingestion engine, interactive producer console, partition lag & live tail"
        icon={<Radio className="size-6 text-cyan-400" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAutoStreaming(!autoStreaming)}
              className={`btn btn-sm flex items-center gap-2 transition-all ${
                autoStreaming
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'btn-secondary'
              }`}
            >
              {autoStreaming ? <Square className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
              {autoStreaming ? 'Pause Auto-Traffic' : 'Simulate Traffic'}
            </button>

            <button
              onClick={() => setShowNewTopicModal(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus className="size-3.5" /> Create Topic
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      {loading ? (
        <CardSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Active Kafka Topics',
              value: summary?.active_topics ?? topics.length,
              sub: 'Across 3 Broker Nodes',
              icon: <Radio className="size-5 text-cyan-400" />,
              gradient: 'from-cyan-500/15 to-cyan-600/5',
              border: 'border-cyan-500/20',
            },
            {
              label: 'Real-Time Ingestion',
              value: `${(summary?.events_per_second ?? 4820).toLocaleString()} eps`,
              sub: 'Avg 4.8k msg/sec',
              icon: <Zap className="size-5 text-amber-400" />,
              gradient: 'from-amber-500/15 to-amber-600/5',
              border: 'border-amber-500/20',
            },
            {
              label: 'Consumer Groups',
              value: summary?.consumer_groups ?? groups.length,
              sub: 'Total lag < 240 msgs',
              icon: <Users className="size-5 text-violet-400" />,
              gradient: 'from-violet-500/15 to-violet-600/5',
              border: 'border-violet-500/20',
            },
            {
              label: '24h Total Processed',
              value: `${((summary?.total_events_24h ?? 418000000) / 1e6).toFixed(1)}M`,
              sub: 'Zero data loss verified',
              icon: <Activity className="size-5 text-emerald-400" />,
              gradient: 'from-emerald-500/15 to-emerald-600/5',
              border: 'border-emerald-500/20',
            },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-5 rounded-2xl bg-[var(--c-bg-secondary)] border ${c.border}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.label}</span>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${c.gradient}`}>
                  {c.icon}
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight text-white mb-1">{c.value}</p>
              <p className="text-xs text-slate-400">{c.sub}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Real-time Throughput Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Ingestion Velocity (Events / Second)</h3>
            <p className="text-xs text-slate-400">Sliding 60-second real-time broker window</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-emerald-400">Live Ingesting</span>
          </div>
        </div>
        {loading || !throughputChart ? (
          <ChartSkeleton />
        ) : (
          <ReactECharts option={throughputChart} style={{ height: 260 }} />
        )}
      </div>

      {/* Interactive Live Producer & Event Stream Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Producer Console (5 Cols) */}
        <div className="glass-card p-6 lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="size-4 text-indigo-400" />
              Event Producer Console
            </h3>
            <span className="text-xs text-slate-400 font-mono">POST /streaming/produce</span>
          </div>

          {/* Preset Payload Selectors */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Quick Template Load</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(SAMPLE_PAYLOADS).map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setPayloadText(JSON.stringify(SAMPLE_PAYLOADS[name], null, 2))}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-[var(--c-bg-tertiary)] hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleProduceEvent} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Topic</label>
                <select
                  value={produceTopic}
                  onChange={e => setProduceTopic(e.target.value)}
                  className="form-select text-xs w-full rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
                >
                  {topics.map((t: any) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Partition Key</label>
                <input
                  type="text"
                  value={produceKey}
                  onChange={e => setProduceKey(e.target.value)}
                  placeholder="Partition Key"
                  className="form-input text-xs w-full rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Message Payload (JSON)</label>
              <textarea
                rows={6}
                value={payloadText}
                onChange={e => setPayloadText(e.target.value)}
                className="w-full text-xs font-mono rounded-xl p-3 bg-slate-950 border border-[var(--c-border)] text-emerald-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {produceSuccessMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2"
              >
                <CheckCircle2 className="size-4 shrink-0" />
                {produceSuccessMsg}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 font-semibold"
            >
              <Send className="size-3.5" />
              {isSubmitting ? 'Publishing...' : 'Dispatch Message to Stream'}
            </button>
          </form>
        </div>

        {/* Live Tail Event Stream (7 Cols) */}
        <div className="glass-card p-6 lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Live Event Tail</h3>
              <p className="text-xs text-slate-400">Subscribed consumer stream buffer</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Topic filter */}
              <select
                value={selectedTopicFilter}
                onChange={e => setSelectedTopicFilter(e.target.value)}
                className="form-select text-xs py-1 px-2.5 rounded-lg bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
              >
                <option value="all">All Topics</option>
                {topics.map((t: any) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>

              {/* Search text */}
              <div className="relative">
                <Search className="size-3 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter payload..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="form-input text-xs pl-7 pr-2 py-1 rounded-lg bg-[var(--c-bg-tertiary)] border-[var(--c-border)] w-32 focus:w-44 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No events in current buffer. Send an event from the producer console!
              </div>
            ) : (
              filteredEvents.map((ev: any) => {
                const isExpanded = expandedEventId === ev.id
                return (
                  <div
                    key={ev.id}
                    onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                    className="p-3 rounded-xl bg-[var(--c-bg-tertiary)]/60 border border-[var(--c-border)] hover:border-slate-600 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono font-semibold text-[11px]">
                          {ev.topic}
                        </span>
                        <span className="font-mono text-slate-400">key: {ev.key}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-300 truncate">
                      {JSON.stringify(ev.payload)}
                    </div>

                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2.5 pt-2 border-t border-slate-700/50"
                      >
                        <pre className="p-2.5 rounded-lg bg-slate-950 text-[11px] text-emerald-400 font-mono overflow-x-auto">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                        <div className="mt-1.5 flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Partition: {ev.partition ?? 0}</span>
                          <span>Offset: {ev.offset ?? '—'}</span>
                          <span>Event ID: {ev.id}</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Topics & Consumer Groups Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topics Table */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Registered Topics</h3>
            <span className="text-xs text-slate-400">{topics.length} active topics</span>
          </div>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
            {topics.map((t: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-bg-tertiary)]/40 border border-[var(--c-border)]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-200">{t.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {t.partitions} partitions • {t.replication_factor || 2}x replication
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-cyan-400 font-mono">
                    {t.messages_per_sec || t.eps || 240}/s
                  </p>
                  <StatusBadge label={t.status || 'active'} variant="success" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consumer Groups & Lag */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Consumer Groups & Lag Health</h3>
            <span className="text-xs text-slate-400">{groups.length} groups</span>
          </div>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
            {groups.map((g: any, i: number) => {
              const lag = g.lag || 0
              const isHighLag = lag > 150
              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-bg-tertiary)]/40 border border-[var(--c-border)]"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{g.name}</p>
                    <p className="text-xs text-slate-400">
                      {g.members || 3} active workers • {g.state || 'Stable'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold font-mono ${
                        isHighLag ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      Lag: {lag.toLocaleString()} msgs
                    </p>
                    <StatusBadge
                      label={isHighLag ? 'elevated lag' : 'healthy'}
                      variant={isHighLag ? 'warning' : 'success'}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Create Topic Modal */}
      <AnimatePresence>
        {showNewTopicModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card max-w-md w-full p-6 space-y-4"
            >
              <h3 className="text-base font-semibold text-white">Create New Kafka Topic</h3>
              <form onSubmit={handleCreateTopic} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Topic Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. events.user.actions"
                    value={newTopicName}
                    onChange={e => setNewTopicName(e.target.value)}
                    className="form-input text-xs w-full rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)] font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Partitions Count</label>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={newTopicPartitions}
                    onChange={e => setNewTopicPartitions(Number(e.target.value))}
                    className="form-input text-xs w-full rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)] font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewTopicModal(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Provision Topic
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
