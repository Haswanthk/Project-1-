import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useAuthStore } from '../state/authStore'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore((state) => state.setTokens)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    setErrorMsg(null)
    try {
      const { data } = await apiClient.post('/auth/login', {
        email: values.email.toLowerCase().trim(),
        password: values.password,
      })
      setTokens(data.access_token, data.refresh_token)
      navigate('/dashboard')
    } catch (err: any) {
      if (err.response?.status === 401) {
        setErrorMsg('Invalid email or password. Please check your credentials or create an account.')
      } else if (err.response?.data?.detail) {
        setErrorMsg(err.response.data.detail)
      } else {
        setErrorMsg('Failed to connect to authentication service. Please ensure backend is running.')
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-violet-600/30 border border-violet-500/40 text-violet-300">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Enterprise AI Platform</h1>
              <p className="text-xs text-slate-400">Sign in to your workspace</p>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                {...register('email')}
                placeholder="admin@enterprise.ai"
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-400"
              />
              {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-400"
              />
              {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3 font-semibold text-sm text-white transition shadow-lg shadow-violet-950/50 disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in to Platform'}
            </button>
          </div>

          <p className="pt-2 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-violet-400 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
