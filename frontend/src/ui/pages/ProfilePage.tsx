import { useEffect, useState } from 'react'
import { User, Save, Check } from 'lucide-react'


import { GlassCard } from '../components/ui/GlassCard'
import { apiClient } from '../lib/api'

type UserProfile = {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState(false)

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/users/me')
      setProfile(res.data)
      setFullName(res.data.full_name || '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await apiClient.patch('/users/me', { full_name: fullName })
      setProfile(res.data)
      setUpdated(true)
      setTimeout(() => setUpdated(false), 3000)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">User Account & Role Profile</h2>
        <p className="text-sm text-slate-400">Manage user credentials, personal information, and platform authorization</p>
      </div>

      {updated && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <Check className="size-5" /> Profile updated successfully!
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading user profile...</div>
      ) : profile ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <GlassCard className="space-y-4 text-center p-6">
            <div className="mx-auto size-20 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-200 text-3xl font-extrabold">
              {profile.email[0].toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{profile.full_name || profile.email}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{profile.email}</p>
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-xs font-bold text-violet-300 uppercase">
              Role: {profile.role}
            </div>
          </GlassCard>

          {/* Edit Form */}
          <GlassCard className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <User className="size-5 text-violet-400" /> Account Details
            </h3>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Email Address (Read-only)</label>
                <input
                  type="email"
                  disabled
                  value={profile.email}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2.5 text-slate-400 font-mono text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 font-semibold text-white hover:bg-violet-500 transition"
                >
                  <Save className="size-4" /> Save Profile
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      ) : null}
    </div>
  )
}
