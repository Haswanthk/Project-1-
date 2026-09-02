import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Send, User, Sparkles, Loader2 } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'

type Message = { role: 'user' | 'assistant'; content: string; timestamp: string }

export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I\'m your AI Analytics Assistant. I can help you with data analysis, model insights, report generation, and more. What would you like to explore?', timestamp: new Date().toISOString() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages(m => [...m, userMsg])
    setInput(''); setLoading(true)
    try {
      const r = await apiClient.post('/ai/chat-with-data', { prompt: userMsg.content })
      setMessages(m => [...m, { role: 'assistant', content: r.data.response || r.data.answer || JSON.stringify(r.data), timestamp: new Date().toISOString() }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'I apologize, but I need a GenAI API key to process your request. Please configure it in the backend settings.', timestamp: new Date().toISOString() }])
    }
    setLoading(false)
  }

  const suggestions = ['Summarize my latest dataset', 'What models are performing best?', 'Generate an executive report', 'Detect anomalies in revenue data']

  return (
    <div className="p-6 space-y-5 flex flex-col h-[calc(100vh-80px)]">
      <PageHeader title="AI Assistant" subtitle="Ask questions about your data, models, and analytics" icon={<Bot className="size-6" />} />

      {/* Chat Area */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 h-fit shrink-0"><Bot className="size-4 text-indigo-400" /></div>
              )}
              <div className={`max-w-[70%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'chat-bubble-user bg-indigo-600/20 border border-indigo-500/20 text-white' : 'chat-bubble-ai bg-[var(--c-bg-secondary)] border border-[var(--c-border)] text-[var(--c-text-primary)]'}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] text-[var(--c-text-muted)] mt-2">{new Date(msg.timestamp).toLocaleTimeString()}</p>
              </div>
              {msg.role === 'user' && (
                <div className="p-2 rounded-xl bg-indigo-600/20 h-fit shrink-0"><User className="size-4 text-indigo-400" /></div>
              )}
            </motion.div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10"><Bot className="size-4 text-indigo-400" /></div>
              <div className="p-4 rounded-2xl chat-bubble-ai bg-[var(--c-bg-secondary)] border border-[var(--c-border)]"><Loader2 className="size-4 animate-spin text-indigo-400" /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button key={s} onClick={() => { setInput(s); }} className="text-xs px-3 py-1.5 rounded-full bg-indigo-500/8 border border-indigo-500/15 text-indigo-400 hover:bg-indigo-500/15 transition">
                <Sparkles className="size-3 inline mr-1" />{s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-[var(--c-border)]">
          <div className="flex gap-3">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about your data..." className="form-input flex-1" />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={sendMessage} disabled={!input.trim() || loading}
              className="btn btn-primary btn-icon px-4"><Send className="size-4" /></motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
