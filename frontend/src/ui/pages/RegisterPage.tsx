import { useState } from 'react'
import { motion } from 'framer-motion'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AlertCircle, UserPlus, ArrowRight, Eye, EyeOff, Check } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useAuthStore } from '../state/authStore'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine(data => data.password === data.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type FormValues = z.infer<typeof schema>

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Contains number', test: (p: string) => /\d/.test(p) },
]

export function RegisterPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore(s => s.setTokens)
  const setUser = useAuthStore(s => s.setUser)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })
  const watchPw = watch('password', '')

  const onSubmit = async (values: FormValues) => {
    setErrorMsg(null)
    try {
      await apiClient.post('/auth/register', {
        full_name: values.full_name.trim(),
        email: values.email.toLowerCase().trim(),
        password: values.password,
      })
      // Auto-login after registration
      const { data } = await apiClient.post('/auth/login', {
        email: values.email.toLowerCase().trim(),
        password: values.password,
      })
      setTokens(data.access_token, data.refresh_token)
      try {
        const meRes = await apiClient.get('/users/me', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        })
        setUser(meRes.data)
      } catch { /* proceed */ }
      navigate('/dashboard')
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setErrorMsg(err.response.data.detail)
      } else {
        setErrorMsg('Registration failed. Please try again.')
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/[0.07] blur-[100px] animate-float" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/[0.06] blur-[80px] animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-br from-violet-600/25 to-indigo-600/15 border border-violet-500/20 text-violet-400 mb-4">
            <UserPlus className="size-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create account</h1>
          <p className="text-sm text-slate-400 mt-2">Join the Enterprise AI Platform</p>
        </motion.div>

        <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-7 space-y-4">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm"
            >
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          <div>
            <label className="form-label">Full Name</label>
            <input {...register('full_name')} placeholder="John Doe" className="form-input" autoComplete="name" />
            {errors.full_name && <p className="mt-1.5 text-xs text-rose-400">{errors.full_name.message}</p>}
          </div>

          <div>
            <label className="form-label">Email Address</label>
            <input {...register('email')} placeholder="john@company.com" className="form-input" autoComplete="email" />
            {errors.email && <p className="mt-1.5 text-xs text-rose-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className="form-label">Password</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                className="form-input pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-xs text-rose-400">{errors.password.message}</p>}
            {watchPw && (
              <div className="mt-2 space-y-1">
                {PASSWORD_RULES.map(rule => (
                  <div key={rule.label} className={`flex items-center gap-2 text-xs ${rule.test(watchPw) ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <Check className="size-3" />
                    {rule.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Confirm Password</label>
            <input {...register('confirm')} type="password" placeholder="••••••••" className="form-input" autoComplete="new-password" />
            {errors.confirm && <p className="mt-1.5 text-xs text-rose-400">{errors.confirm.message}</p>}
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary w-full py-3.5 text-sm"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating account...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                Create Account
                <ArrowRight className="size-4" />
              </div>
            )}
          </motion.button>

          <p className="pt-1 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition">
              Sign in
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
