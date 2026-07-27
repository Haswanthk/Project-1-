import { useState, useEffect } from 'react';
import { Palette, Key, Server, Save, RotateCcw, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../lib/api';

interface AIProvider {
  id: string;
  name: string;
  enabled: boolean;
  apiKey: string;
}

const PRESET_COLORS = [
  { name: 'Blue', h: '210', s: '100%', l: '50%' },
  { name: 'Purple', h: '270', s: '100%', l: '60%' },
  { name: 'Emerald', h: '150', s: '100%', l: '40%' },
  { name: 'Rose', h: '350', s: '100%', l: '60%' },
  { name: 'Amber', h: '45', s: '100%', l: '50%' },
  { name: 'Slate', h: '215', s: '25%', l: '27%' }
];

export function SettingsPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  
  const [isDark, setIsDark] = useState(
    localStorage.getItem('theme') === 'dark' || 
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  const [activeColorH, setActiveColorH] = useState('210');
  
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.example.com/v1');
  const [corsOrigin, setCorsOrigin] = useState('*');

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await apiClient.get('/ai/providers');
        setProviders(response.data);
      } catch (error) {
        console.error('Failed to fetch AI providers', error);
        // Fallback for demo
        setProviders([
          { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-.......................................' },
          { id: 'anthropic', name: 'Anthropic (Claude)', enabled: false, apiKey: '' },
          { id: 'gemini', name: 'Google Gemini', enabled: true, apiKey: 'AIzaSy..................................' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
    
    // Read current CSS vars if available
    const root = document.documentElement;
    const h = getComputedStyle(root).getPropertyValue('--accent-h').trim();
    if (h) setActiveColorH(h);
    
  }, []);

  const handleColorChange = (h: string, s: string, l: string) => {
    setActiveColorH(h);
    const root = document.documentElement;
    root.style.setProperty('--accent-h', h);
    root.style.setProperty('--accent-s', s);
    root.style.setProperty('--accent-l', l);
  };

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    if (newDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleProviderToggle = (id: string) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleProviderKeyChange = (id: string, key: string) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, apiKey: key } : p));
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = () => {
    // In a real app, POST to /settings or similar
    alert('Settings saved successfully!');
  };

  return (
    <div className="animate-fade-in-up stagger-1 p-6 space-y-8 max-w-4xl mx-auto">
      <header className="flex justify-between items-end border-b border-[var(--c-border)] pb-4">
        <div>
          <h1 className="section-title text-2xl font-bold">Settings</h1>
          <p className="section-subtitle text-sm text-[var(--c-text-secondary)] mt-1">Manage workspace preferences, integrations, and application settings.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary px-4 py-2 rounded-md flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button onClick={handleSave} className="btn btn-primary px-4 py-2 rounded-md flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </header>

      {/* Appearance Section */}
      <section className="glass-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Palette className="w-5 h-5 text-[var(--c-text-secondary)]" />
          Appearance
        </h2>
        
        <div className="space-y-6">
          <div>
            <label className="form-label block text-sm font-medium mb-3">Theme</label>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => !isDark && toggleTheme()}
                className={`px-4 py-3 border rounded-lg flex-1 font-medium transition-colors ${!isDark ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-accent)]' : 'border-[var(--c-border)] text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elevated)]'}`}
              >
                Light
              </button>
              <button 
                onClick={() => isDark && toggleTheme()}
                className={`px-4 py-3 border rounded-lg flex-1 font-medium transition-colors ${isDark ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-accent)]' : 'border-[var(--c-border)] text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elevated)]'}`}
              >
                Dark
              </button>
            </div>
          </div>

          <div>
            <label className="form-label block text-sm font-medium mb-3">Accent Color</label>
            <div className="flex flex-wrap gap-3">
              {PRESET_COLORS.map(color => (
                <button
                  key={color.name}
                  onClick={() => handleColorChange(color.h, color.s, color.l)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${activeColorH === color.h ? 'ring-2 ring-offset-2 ring-[var(--c-text)] ring-offset-[var(--c-bg)]' : ''}`}
                  style={{ backgroundColor: `hsl(${color.h}, ${color.s}, ${color.l})` }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Providers Section */}
      <section className="glass-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Key className="w-5 h-5 text-[var(--c-text-secondary)]" />
          AI Providers
        </h2>
        
        {loading ? (
          <div className="space-y-4">
            <div className="skeleton h-16 w-full rounded-lg"></div>
            <div className="skeleton h-16 w-full rounded-lg"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map(provider => (
              <div key={provider.id} className="p-4 border border-[var(--c-border)] rounded-lg bg-[var(--c-bg)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium">{provider.name}</div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={provider.enabled}
                      onChange={() => handleProviderToggle(provider.id)}
                    />
                    <div className="w-11 h-6 bg-[var(--c-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--c-accent)]"></div>
                  </label>
                </div>
                
                <div className={`transition-all duration-300 overflow-hidden ${provider.enabled ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <label className="block text-xs text-[var(--c-text-secondary)] mb-1">API Key</label>
                  <div className="relative">
                    <input
                      type={showKeys[provider.id] ? "text" : "password"}
                      className="form-input w-full p-2 pr-10 rounded-md border border-[var(--c-border)] bg-[var(--c-bg-elevated)] text-sm font-mono"
                      value={provider.apiKey}
                      onChange={(e) => handleProviderKeyChange(provider.id, e.target.value)}
                      placeholder={`Enter ${provider.name} API Key`}
                    />
                    <button 
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--c-text-secondary)] hover:text-[var(--c-text)]"
                      onClick={() => toggleKeyVisibility(provider.id)}
                    >
                      {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* API Configuration Section */}
      <section className="glass-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Server className="w-5 h-5 text-[var(--c-text-secondary)]" />
          API Configuration
        </h2>
        
        <div className="space-y-5">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg flex gap-3 items-start text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>Changing these settings may break connection to the backend services. Only modify if you know what you're doing.</p>
          </div>

          <div>
            <label className="form-label block text-sm font-medium mb-1">Backend Base URL</label>
            <input
              type="text"
              className="form-input w-full p-2 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)] font-mono text-sm"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label block text-sm font-medium mb-1">CORS Allowed Origins</label>
            <input
              type="text"
              className="form-input w-full p-2 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)] font-mono text-sm"
              value={corsOrigin}
              onChange={(e) => setCorsOrigin(e.target.value)}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

