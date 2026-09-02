import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Send, User, Sparkles, Loader2, Trash2, Cpu } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'

type Message = { role: 'user' | 'assistant'; content: string; timestamp: string }

export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your Google Gemini Analytics Copilot. I have live access to your workspace datasets, models, and analytics. Ask me to analyze datasets, write SQL, explain models, or provide strategic insights.",
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? input).trim()
    if (!textToSend || loading) return

    const userMsg: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await apiClient.post('/ai/chat-with-data', {
        prompt: textToSend,
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
      })
      const answer =
        res.data.response ||
        res.data.answer ||
        (typeof res.data === 'string' ? res.data : 'Analysis completed.')
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: answer,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            err.response?.data?.detail ||
            'Unable to reach AI assistant service. Please verify server connectivity.',
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          "Chat reset. I'm ready to answer any questions about your datasets, ML models, or analytics.",
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const suggestions = [
    'What datasets are currently in my workspace?',
    'Explain the top features for predicting customer churn',
    'Write a SQL query to find high-value transactions',
    'Compare Random Forest vs Gradient Boosting for classification',
  ]

  return (
    <div className="p-6 space-y-5 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader
          title="AI Assistant"
          subtitle="Real-time intelligent analytics copilot powered by Google Gemini"
          icon={<Bot className="size-6" />}
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <Cpu className="size-3.5" /> Gemini 2.5 Flash Live
          </span>
          <button
            onClick={clearChat}
            className="btn btn-ghost btn-xs text-[var(--c-text-muted)] hover:text-white"
            title="Clear Chat History"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 h-fit shrink-0 border border-indigo-500/20">
                  <Bot className="size-4 text-indigo-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'chat-bubble-user bg-indigo-600/30 border border-indigo-500/30 text-white'
                    : 'chat-bubble-ai bg-[var(--c-bg-secondary)] border border-[var(--c-border)] text-slate-100 leading-relaxed shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans space-y-2">{msg.content}</div>
                <p className="text-[10px] text-[var(--c-text-muted)] mt-2.5">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="p-2 rounded-xl bg-indigo-600/20 h-fit shrink-0 border border-indigo-500/20">
                  <User className="size-4 text-indigo-400" />
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/20">
                <Bot className="size-4 text-indigo-400" />
              </div>
              <div className="p-4 rounded-2xl chat-bubble-ai bg-[var(--c-bg-secondary)] border border-[var(--c-border)] flex items-center gap-2 text-xs text-indigo-300">
                <Loader2 className="size-4 animate-spin text-indigo-400" />
                Thinking & analyzing with Google Gemini...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-indigo-500/8 border border-indigo-500/15 text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition flex items-center gap-1.5"
              >
                <Sparkles className="size-3 text-indigo-400" />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <div className="p-4 border-t border-[var(--c-border)] bg-[var(--c-bg-card)]">
          <form
            onSubmit={e => {
              e.preventDefault()
              sendMessage()
            }}
            className="flex gap-3"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about your datasets, SQL, statistics, ML models..."
              className="form-input flex-1"
              disabled={loading}
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              disabled={!input.trim() || loading}
              className="btn btn-primary px-5"
            >
              <Send className="size-4" />
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
