import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AlertCircle, ArrowRight, ArrowLeft, Eye, EyeOff, Shield, Check, Cpu } from 'lucide-react'
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
  { label: '8+ Characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase Character', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Numeric Digit', test: (p: string) => /\d/.test(p) },
]

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = []
    const PARTICLE_COUNT = 45

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.35 + 0.1,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p, i) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha})`
        ctx.fill()

        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x
          const dy = p.y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.05 * (1 - dist / 100)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />
}

export function RegisterPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore(s => s.setTokens)
  const setUser = useAuthStore(s => s.setUser)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })
  const watchPw = watch('password', '')

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -5
    const rotateY = ((x - centerX) / centerX) * 5
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(6px)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
  }, [])

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
        setErrorMsg('Node registration failed. Please verify connection.')
      }
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden bg-[#04060e]">
      {/* Dynamic Background */}
      <ParticleCanvas />
      <div className="wireframe-grid">
        <div className="wireframe-grid-inner" />
      </div>

      {/* Atmospheric neon glows */}
      <div className="absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-cyan-500/[0.04] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 -left-20 w-[400px] h-[400px] rounded-full bg-violet-600/[0.05] blur-[140px] pointer-events-none" />

      {/* Back to Home Link */}
      <Link
        to="/"
        className="absolute top-8 left-8 z-20 flex items-center gap-2 font-mono text-xs text-[#7a8ba5] hover:text-cyan-400 transition-colors uppercase tracking-widest group"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
        <span>Terminal Root</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md my-8"
      >
        {/* Terminal Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 text-cyan-400 mb-4 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
            <Cpu className="size-7" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="inline-block size-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="font-mono text-xs text-violet-400/80 tracking-[0.2em] uppercase">Provision Node</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-wider">
            REGISTER IDENTITY
          </h1>
          <p className="font-mono text-xs text-[#7a8ba5] mt-2">
            Initialize your neural workspace & telemetry keys
          </p>
        </div>

        {/* 3D Cyber Form Card */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="cyber-card p-8 transition-transform duration-200 ease-out"
        >
          <div className="scanner-overlay absolute inset-0 pointer-events-none" />

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3.5 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs leading-relaxed"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Operator Full Name</label>
              <input
                {...register('full_name')}
                placeholder="Ada Lovelace"
                className="form-input"
                autoComplete="name"
              />
              {errors.full_name && (
                <p className="mt-1.5 font-mono text-xs text-rose-400">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Network Identifier (Email)</label>
              <input
                {...register('email')}
                placeholder="operator@enterprise.ai"
                className="form-input"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1.5 font-mono text-xs text-rose-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Access Passkey</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  className="form-input pr-10 tracking-widest"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a8ba5] hover:text-cyan-400 transition"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 font-mono text-xs text-rose-400">{errors.password.message}</p>
              )}

              {/* Password complexity metrics */}
              {watchPw && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-black/40 border border-cyan-500/10 space-y-1">
                  {PASSWORD_RULES.map(rule => {
                    const passed = rule.test(watchPw)
                    return (
                      <div
                        key={rule.label}
                        className={`flex items-center gap-2 font-mono text-[11px] transition-colors ${
                          passed ? 'text-[#00ffa3]' : 'text-[#3a4558]'
                        }`}
                      >
                        <Check className={`size-3 ${passed ? 'opacity-100' : 'opacity-40'}`} />
                        <span>{rule.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Confirm Passkey</label>
              <input
                {...register('confirm')}
                type="password"
                placeholder="••••••••••••"
                className="form-input tracking-widest"
                autoComplete="new-password"
              />
              {errors.confirm && (
                <p className="mt-1.5 font-mono text-xs text-rose-400">{errors.confirm.message}</p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-neon-solid w-full py-3.5 text-sm group mt-2"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>PROVISIONING NODE...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>DEPLOY NEW OPERATOR</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </motion.button>

            <div className="pt-2 flex items-center justify-center gap-2 font-mono text-[10px] text-[#3a4558]">
              <Shield className="size-3 text-violet-400/50" />
              <span>STRICT ZERO-TRUST SECURITY ENFORCED</span>
            </div>

            <div className="pt-3 border-t border-cyan-500/10 text-center">
              <p className="font-mono text-xs text-[#7a8ba5]">
                Existing node operator?{' '}
                <Link to="/login" className="text-cyan-400 hover:underline font-bold ml-1">
                  SIGN IN
                </Link>
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
