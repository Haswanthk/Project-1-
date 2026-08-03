import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Plus, Trash2, Database, Bot, User, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { apiClient } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface Dataset {
  id: string;
  name: string;
}

export function AIAssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: '1', title: 'Q3 Sales Analysis', updatedAt: new Date().toISOString() },
    { id: '2', title: 'User Retention Trends', updatedAt: new Date().toISOString() },
  ]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  
  const [providerStatus, setProviderStatus] = useState<'connected' | 'fallback' | 'loading'>('loading');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProviders();
    fetchDatasets();
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      fetchConversation(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchProviders = async () => {
    try {
      setProviderStatus('loading');
      const response = await apiClient.get('/ai/providers');
      // Assume response.data.activeProvider is 'openai' or similar, else fallback
      if (response.data && response.data.activeProvider && response.data.activeProvider !== 'none') {
        setProviderStatus('connected');
      } else {
        setProviderStatus('fallback');
      }
    } catch (error) {
      console.error('Failed to fetch providers', error);
      setProviderStatus('fallback');
    }
  };

  const fetchDatasets = async () => {
    try {
      const response = await apiClient.get('/datasets/');
      if (response.data && Array.isArray(response.data)) {
        setDatasets(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch datasets', error);
    }
  };

  const fetchConversation = async (id: string) => {
    try {
      const response = await apiClient.get(`/ai/conversations/${id}`);
      if (response.data && response.data.messages) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch conversation', error);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/ai/conversations/${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsStreaming(true);
    setStreamingMessage('');

    try {
      // Create new conversation if none selected
      let activeConvId = currentConversationId;
      if (!activeConvId) {
        activeConvId = Date.now().toString();
        setCurrentConversationId(activeConvId);
        setConversations(prev => [{ id: activeConvId!, title: currentInput.substring(0, 40) + '...', updatedAt: new Date().toISOString() }, ...prev]);
      }

      // Get auth token for streaming request
      const { useAuthStore } = await import('../state/authStore');
      const token = useAuthStore.getState().accessToken;

      const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

      // Try SSE streaming endpoint first
      let aiContent = '';
      try {
        const response = await fetch(`${baseUrl}/ai/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content: currentInput,
            conversation_id: activeConvId,
            dataset_context: selectedDataset || null,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error('No response body');

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let done   = false;
        let buffer = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (!dataStr || dataStr === '[DONE]') {
                  if (dataStr === '[DONE]') done = true;
                  continue;
                }
                try {
                  const data = JSON.parse(dataStr);
                  if (data.content) {
                    aiContent += data.content;
                    setStreamingMessage(aiContent);
                  }
                  if (data.done) done = true;
                } catch (_) { /* incomplete JSON chunk */ }
              }
            }
          }
          if (readerDone) done = true;
        }
      } catch (streamErr) {
        // Fallback: non-streaming /ai/chat-with-data
        console.warn('SSE stream failed, using fallback:', streamErr);
        const fallback = await apiClient.post('/ai/chat-with-data', { prompt: currentInput });
        aiContent = fallback.data?.response ?? 'Unable to generate a response.';
        setStreamingMessage(aiContent);
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: aiContent }]);
    } catch (error) {
      console.error('Chat error', error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'An error occurred while generating the response. Please try again.' }]);
    } finally {
      setIsStreaming(false);
      setStreamingMessage('');
    }

  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown parsing
    let html = text
      // Replace code blocks
      .replace(/```([\s\S]*?)```/g, '<pre style="background: var(--c-bg-elevated); padding: 1rem; border-radius: 0.5rem; margin: 0.5rem 0; overflow-x: auto; font-family: monospace; font-size: 0.875rem;"><code>$1</code></pre>')
      // Replace inline code
      .replace(/`([^`]+)`/g, '<code style="background: var(--c-bg-elevated); padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.875rem;">$1</code>')
      // Replace bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Replace newlines
      .replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: '1.6' }} />;
  };

  const suggestedQuestions = [
    "What are the key drivers for revenue this month?",
    "Summarize user retention trends for Q3",
    "Identify anomalies in the recent transaction data",
    "How does current performance compare to last year?"
  ];

  const handleChipClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className="flex h-full w-full gap-6 p-6 animate-fade-in-up">
      {/* Sidebar */}
      <div className="w-80 flex flex-col gap-4">
        <div className="glass-card p-4 flex flex-col gap-4 flex-1 overflow-hidden">
          <button 
            className="btn btn-primary w-full flex items-center justify-center gap-2"
            onClick={handleNewConversation}
          >
            <Plus size={18} />
            New Chat
          </button>
          
          <div className="flex flex-col gap-2 overflow-y-auto mt-4">
            <h3 className="text-sm font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-2">Recent</h3>
            {conversations.map(conv => (
              <div 
                key={conv.id}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${currentConversationId === conv.id ? 'bg-[var(--c-bg-elevated)] border border-[var(--c-accent)]' : 'hover:bg-[var(--c-bg-elevated)] border border-transparent'}`}
                onClick={() => setCurrentConversationId(conv.id)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={16} className="text-[var(--c-text-secondary)] shrink-0" />
                  <span className="truncate text-sm font-medium">{conv.title}</span>
                </div>
                <button 
                  className="text-[var(--c-text-secondary)] hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  style={{ opacity: currentConversationId === conv.id ? 1 : undefined }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="section-header mb-0">
            <h1 className="section-title flex items-center gap-2">
              <Sparkles className="text-[var(--c-accent)]" /> 
              AI Analytics Copilot
            </h1>
            <p className="section-subtitle">Ask questions, generate insights, and analyze your data</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Dataset Context Selector */}
            <div className="flex items-center gap-2">
              <Database size={16} className="text-[var(--c-text-secondary)]" />
              <select 
                className="form-select text-sm py-1.5"
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
              >
                <option value="">Global Context</option>
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            
            {/* Provider Badge */}
            {providerStatus === 'connected' ? (
              <div className="badge badge-success flex items-center gap-1.5">
                <CheckCircle size={14} />
                OpenAI Connected
              </div>
            ) : providerStatus === 'fallback' ? (
              <div className="badge badge-warning flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Fallback Mode
              </div>
            ) : (
              <div className="skeleton h-6 w-32 rounded-full"></div>
            )}
          </div>
        </div>

        <div className="glass-card flex-1 flex flex-col overflow-hidden relative">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {messages.length === 0 && !isStreaming ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-[var(--c-bg-elevated)] flex items-center justify-center mb-6 border border-[var(--c-border)] shadow-lg">
                  <Bot size={32} className="text-[var(--c-accent)]" />
                </div>
                <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
                <p className="text-[var(--c-text-secondary)] max-w-md mb-8">
                  Select a dataset to context-ground your query, or ask global questions about your analytics workspace.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                  {suggestedQuestions.map((q, idx) => (
                    <button 
                      key={idx}
                      className="glass-card p-4 text-left hover:border-[var(--c-accent)] transition-all text-sm font-medium hover:-translate-y-0.5"
                      onClick={() => handleChipClick(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-[var(--c-accent)] text-white' : 'bg-[var(--c-bg-elevated)] border border-[var(--c-border)] text-[var(--c-text-primary)]'}`}>
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[var(--c-accent)] text-white chat-bubble-user rounded-tr-sm' : 'bg-[var(--c-bg-elevated)] border border-[var(--c-border)] chat-bubble-ai rounded-tl-sm shadow-sm'}`}>
                      {msg.role === 'user' ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      ) : (
                        renderMarkdown(msg.content)
                      )}
                    </div>
                  </div>
                ))}
                
                {isStreaming && (
                  <div className="flex gap-4 max-w-[85%] self-start animate-fade-in">
                    <div className="w-8 h-8 rounded-full bg-[var(--c-bg-elevated)] border border-[var(--c-border)] flex items-center justify-center shrink-0 mt-1">
                      <Bot size={16} className="text-[var(--c-text-primary)]" />
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--c-bg-elevated)] border border-[var(--c-border)] chat-bubble-ai rounded-tl-sm shadow-sm min-w-[3rem]">
                      {streamingMessage ? renderMarkdown(streamingMessage) : (
                        <div className="flex gap-1 h-6 items-center">
                          <div className="w-1.5 h-1.5 bg-[var(--c-text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-[var(--c-text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-[var(--c-text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          
          {/* Input Area */}
          <div className="p-4 bg-[var(--c-bg-base)] border-t border-[var(--c-border)]">
            <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
              <textarea
                className="form-input w-full resize-none min-h-[56px] max-h-48 py-3 px-4 rounded-xl shadow-sm pr-12"
                placeholder="Ask about your data..."
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 192)}px`;
                }}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
              />
              <div className="absolute right-2 bottom-2">
                <button 
                  className="btn btn-primary w-10 h-10 p-0 rounded-lg flex items-center justify-center"
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
            <div className="text-center mt-2">
              <span className="text-xs text-[var(--c-text-secondary)]">
                AI Analytics Copilot can make mistakes. Consider verifying important data.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
