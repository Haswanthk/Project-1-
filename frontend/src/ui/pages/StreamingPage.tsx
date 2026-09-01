import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Radio, Activity, Zap, Server, ShieldCheck, Pause, Play } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'


export function StreamingPage() {
  const [isStreaming, setIsStreaming] = useState(true)
  const [throughputData, setThroughputData] = useState<number[]>([120, 142, 135, 160, 185, 172, 198, 210, 240, 225, 260, 275])
  const [timeLabels, setTimeLabels] = useState<string[]>([
    '20:10:00', '20:10:05', '20:10:10', '20:10:15', '20:10:20', '20:10:25',
    '20:10:30', '20:10:35', '20:10:40', '20:10:45', '20:10:50', '20:10:55',
  ])
  const [payloadLog, setPayloadLog] = useState<string[]>([
    '{"event_id": "evt-9012", "topic": "kafka.iot.telemetry", "timestamp": "2026-07-26T20:10:50Z", "payload": {"temp": 24.5, "vibration": 0.02}}',
    '{"event_id": "evt-9013", "topic": "kafka.user.clicks", "timestamp": "2026-07-26T20:10:52Z", "payload": {"user_id": 481, "action": "checkout_click"}}',
    '{"event_id": "evt-9014", "topic": "kafka.web.logs", "timestamp": "2026-07-26T20:10:55Z", "payload": {"ip": "192.168.1.104", "status": 200}}',
  ])

  useEffect(() => {
    if (!isStreaming) return
    const interval = setInterval(() => {
      const now = new Date()
      const timeStr = now.toTimeString().split(' ')[0]
      const newVal = Math.floor(Math.random() * 80) + 220
      setThroughputData((prev) => [...prev.slice(1), newVal])
      setTimeLabels((prev) => [...prev.slice(1), timeStr])

      const newLog = `{"event_id": "evt-${Math.floor(Math.random() * 9000) + 1000}", "topic": "kafka.telemetry", "timestamp": "${now.toISOString()}", "payload": {"val": ${(Math.random() * 100).toFixed(2)}}} `
      setPayloadLog((prev) => [newLog, ...prev.slice(0, 7)])
    }, 2000)
    return () => clearInterval(interval)
  }, [isStreaming])

  const getChartOption = () => {
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: timeLabels, axisLabel: { color: '#cbd5e1' } },
      yAxis: { type: 'value', name: 'Events / Sec', nameTextStyle: { color: '#cbd5e1' }, axisLabel: { color: '#cbd5e1' } },
      series: [
        {
          name: 'Events / Sec',
          type: 'line',
          smooth: true,
          data: throughputData,
          itemStyle: { color: '#10b981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
              ],
            },
          },
        },
      ],
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Real-Time Streaming Analytics</h2>
          <p className="text-sm text-slate-400">Low-latency event processing, Kafka message ingestion, and live telemetry</p>
        </div>
        <button
          onClick={() => setIsStreaming(!isStreaming)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            isStreaming ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30' : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {isStreaming ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isStreaming ? 'Pause Real-Time Feed' : 'Resume Live Stream'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300">
              <Zap className="size-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Live Ingestion Rate</p>
              <p className="text-xl font-bold text-white">{throughputData[throughputData.length - 1]} evt/s</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300">
              <Radio className="size-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Kafka Topics Active</p>
              <p className="text-xl font-bold text-white">8 Topics</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300">
              <Server className="size-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Consumer Group Lag</p>
              <p className="text-xl font-bold text-white">0 ms</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Stream Schema Guard</p>
              <p className="text-xl font-bold text-white">Enforced</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Chart */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="size-5 text-emerald-400" /> Live Stream Event Throughput (Events/Sec)
          </h3>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" /> WebSocket Connected
          </span>
        </div>
        <ReactECharts option={getChartOption()} style={{ height: '300px' }} />
      </GlassCard>

      {/* Live Payload Stream Log */}
      <GlassCard>
        <h3 className="text-lg font-bold text-white mb-3">Live Payload Event Inspector</h3>
        <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2 font-mono text-xs max-h-64 overflow-y-auto">
          {payloadLog.map((log, idx) => (
            <div key={idx} className="text-emerald-300/90 border-b border-white/5 pb-1">
              <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
