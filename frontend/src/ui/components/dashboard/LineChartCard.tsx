import ReactECharts from 'echarts-for-react'
import { GlassCard } from '../ui/GlassCard'

export function LineChartCard() {
  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    yAxis: { type: 'value' },
    series: [{ data: [120, 232, 401, 334, 390, 430, 500], type: 'line', smooth: true }],
    backgroundColor: 'transparent',
  }
  return (
    <GlassCard>
      <h3 className="mb-4 text-lg font-semibold">Pipeline Throughput</h3>
      <ReactECharts option={option} style={{ height: 300 }} />
    </GlassCard>
  )
}

