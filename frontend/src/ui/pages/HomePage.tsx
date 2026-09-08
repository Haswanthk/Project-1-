import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Cpu, Zap, ArrowRight, Activity, Database, Brain,
  ChevronDown, Sparkles, Radio, BarChart2, CheckCircle2,
  Layers, LineChart, FileText, Bot, ArrowUpRight,
  Terminal, ShieldCheck
} from 'lucide-react'

/* ── Live Canvas Particle Field ── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = []
    const PARTICLE_COUNT = 75

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
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
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
          if (dist < 110) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.06 * (1 - dist / 110)})`
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

/* ── Animated Scroll Counter ── */
function AnimCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const duration = 1800
          const start = performance.now()
          const step = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(Math.floor(eased * target))
            if (progress < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.4 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return <div ref={ref}>{value.toLocaleString()}{suffix}</div>
}

/* ── 3D Tilt Card ── */
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -6
    const rotateY = ((x - centerX) / centerX) * 6
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
  }, [])

  return (
    <div
      ref={cardRef}
      className={`transition-transform duration-200 ease-out ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  )
}

/* ── Animation Variants ── */
const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }
const fadeUp: Variants = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const } } }

/* ── Platform Architecture Pipeline Steps ── */
const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Data Ingestion & Profiling',
    icon: Database,
    desc: 'Instant ingestion for CSV, Excel, JSON, and external database connectors. Automatically scans schema, computes PCA vectors, detects data types, and flags anomalies.',
    badge: 'Automated Profiling',
  },
  {
    step: '02',
    title: 'Intelligent Preprocessing',
    icon: Layers,
    desc: 'Median-based numeric imputation, categorical one-hot encoding, and class-balanced stratification to ensure clean data hygiene before model ingestion.',
    badge: 'Data Hygiene',
  },
  {
    step: '03',
    title: 'Multi-Algorithm ML Engine',
    icon: Brain,
    desc: 'Train Random Forest, XGBoost, Gradient Boosting, SVM, and KNN in parallel. Run 5-fold cross-validation and view confusion matrices and feature importance.',
    badge: 'Auto-ML & MLOps',
  },
  {
    step: '04',
    title: 'Real-Time Event Streaming',
    icon: Radio,
    desc: 'High-throughput Kafka streaming simulation processing 50,000+ events/sec with sliding window aggregations and live throughput telemetry.',
    badge: 'Kafka Simulation',
  },
  {
    step: '05',
    title: 'Anomaly Detection & AI Diagnostics',
    icon: Activity,
    desc: 'Z-score and Isolation Forest statistical detection combined with automated generative AI root-cause diagnostics to identify failures before customers do.',
    badge: 'Root-Cause AI',
  },
  {
    step: '06',
    title: 'Forecasting & Executive Reports',
    icon: LineChart,
    desc: '90-day time-series projections with polynomial trends and confidence intervals. Generate executive-ready PDF, Excel, and JSON reports in one click.',
    badge: 'BI & Reporting',
  },
]

/* ── Core System Modules ── */
const MODULES = [
  {
    id: 'analytics',
    icon: BarChart2,
    title: 'Analytics & KPIs',
    desc: 'Real-time revenue, customer churn, average order value, conversion rates, and multi-dimensional cohort segmentation.',
    stat: '6 Core Metrics',
    color: 'from-cyan-500/20 to-blue-500/5',
  },
  {
    id: 'mlops',
    icon: Brain,
    title: 'Model Training & Registry',
    desc: '6 algorithms with hyperparameter tuning, 5-fold cross validation, live confusion matrix heatmaps, and one-click model comparison.',
    stat: '100% Verified Acc',
    color: 'from-violet-500/20 to-purple-500/5',
  },
  {
    id: 'streaming',
    icon: Radio,
    title: 'Real-Time Streaming',
    desc: 'Simulated Kafka event pipeline with live chart updates, topic partition stats, consumer lag monitoring, and event buffering.',
    stat: '50K+ Events/sec',
    color: 'from-emerald-500/20 to-teal-500/5',
  },
  {
    id: 'anomaly',
    icon: Activity,
    title: 'Anomaly Detection',
    desc: 'Multi-dimensional Z-score and Isolation Forest detection with automated AI explanations identifying root-cause infrastructure bugs.',
    stat: 'Sub-second Alert',
    color: 'from-amber-500/20 to-orange-500/5',
  },
  {
    id: 'ai-copilot',
    icon: Bot,
    title: 'AI Copilot Assistant',
    desc: 'Grounded streaming copilot that can analyze your datasets, write natural language queries, and recommend operational optimizations.',
    stat: 'SSE Streaming',
    color: 'from-pink-500/20 to-rose-500/5',
  },
  {
    id: 'reporting',
    icon: FileText,
    title: 'Automated Reports',
    desc: 'Generate executive summary reports in PDF, Excel, HTML, and JSON formats, with cron schedule automations for stakeholders.',
    stat: 'Instant Export',
    color: 'from-indigo-500/20 to-cyan-500/5',
  },
]

/* ── Sample Demo Datasets ── */
const SAMPLE_DATASETS = [
  {
    name: 'Iris Flower Classification',
    rows: 150,
    cols: 6,
    type: 'Classification',
    target: 'Species',
    desc: 'Standard multi-class benchmark with sepal and petal measurements. Achieves 100% accuracy with Random Forest.',
  },
  {
    name: 'Customer Churn & LTV',
    rows: 1000,
    cols: 14,
    type: 'Classification',
    target: 'churn_risk',
    desc: 'Telecom and SaaS customer retention metrics including contract tenure, monthly charges, and support tickets.',
  },
  {
    name: 'Enterprise Revenue Telemetry',
    rows: 5000,
    cols: 8,
    type: 'Regression & Forecast',
    target: 'revenue',
    desc: 'Time-series financial transactions across geographic regions with seasonal trends and marketing attribution.',
  },
]

export function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.96])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04060e] text-[#e0e7ef]">
      {/* ── STICKY TOP NAVIGATION BAR ── */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#04060e]/80 border-b border-cyan-500/10 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 group-hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all">
              <Cpu className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-black text-white tracking-widest uppercase">
                ENTERPRISE <span className="text-cyan-400">AI</span>
              </span>
              <span className="font-mono text-[9px] text-[#7a8ba5] tracking-wider">Analytics & MLOps Platform</span>
            </div>
          </Link>

          {/* Quick Nav Anchors */}
          <nav className="hidden md:flex items-center gap-8 font-mono text-xs text-[#7a8ba5]">
            <a href="#overview" className="hover:text-cyan-400 transition-colors uppercase tracking-wider">Overview</a>
            <a href="#pipeline" className="hover:text-cyan-400 transition-colors uppercase tracking-wider">Pipeline</a>
            <a href="#modules" className="hover:text-cyan-400 transition-colors uppercase tracking-wider">Modules</a>
            <a href="#datasets" className="hover:text-cyan-400 transition-colors uppercase tracking-wider">Datasets</a>
            <a href="#architecture" className="hover:text-cyan-400 transition-colors uppercase tracking-wider">Architecture</a>
          </nav>

          {/* Direct Auth CTAs */}
          <div className="flex items-center gap-3">
            <Link to="/login">
              <button type="button" className="btn btn-neon btn-sm">
                SIGN IN
              </button>
            </Link>
            <Link to="/register">
              <button type="button" className="btn btn-neon-solid btn-sm">
                GET STARTED <ArrowRight className="size-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-6 pt-12 pb-20"
      >
        <ParticleCanvas />
        <div className="wireframe-grid">
          <div className="wireframe-grid-inner" />
        </div>

        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-[10%] w-[350px] h-[350px] rounded-full bg-cyan-500/[0.04] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-[10%] w-[350px] h-[350px] rounded-full bg-violet-600/[0.05] blur-[140px] pointer-events-none" />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-4xl mx-auto"
        >
          {/* Status Badge */}
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/5 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-cyan-400" />
            </span>
            <span className="font-mono text-xs text-cyan-300 tracking-widest uppercase font-bold">
              UNIFIED ENTERPRISE AI ANALYTICS ENGINE — v3.0
            </span>
          </motion.div>

          {/* Main Display Heading */}
          <motion.h1
            variants={fadeUp}
            className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-wider leading-[1.08] mb-6 text-white"
          >
            INTELLIGENT DATA <br />
            <span className="text-gradient">COMMAND CENTER</span>
          </motion.h1>

          {/* Project Summary Subtitle */}
          <motion.p
            variants={fadeUp}
            className="font-mono text-sm sm:text-base md:text-lg text-[#7a8ba5] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            A high-performance analytics platform uniting{' '}
            <span className="text-cyan-300">automated MLOps training</span>,{' '}
            sub-millisecond streaming, anomaly detection, and generative AI reporting into a single mission-critical workspace.
          </motion.p>

          {/* Direct CTA Buttons */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-neon-solid btn-xl group w-full sm:w-auto"
              >
                <span>LAUNCH PLATFORM FREE</span>
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-neon btn-xl w-full sm:w-auto"
              >
                <span>SIGN IN TO WORKSPACE</span>
              </motion.button>
            </Link>
          </motion.div>

          {/* Quick Stats Pill Bar */}
          <motion.div
            variants={fadeUp}
            className="mt-14 p-4 rounded-2xl border border-cyan-500/10 bg-black/40 backdrop-blur-md grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <div className="text-center">
              <div className="font-display text-2xl font-black text-cyan-400">
                <AnimCounter target={99} suffix=".9%" />
              </div>
              <p className="font-mono text-[10px] text-[#7a8ba5] uppercase tracking-wider">Uptime SLA</p>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-black text-cyan-400">
                <AnimCounter target={50} suffix="K+" />
              </div>
              <p className="font-mono text-[10px] text-[#7a8ba5] uppercase tracking-wider">Events/sec Stream</p>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-black text-cyan-400">
                <AnimCounter target={10} suffix="ms" />
              </div>
              <p className="font-mono text-[10px] text-[#7a8ba5] uppercase tracking-wider">P99 Latency</p>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-black text-cyan-400">
                <AnimCounter target={100} suffix="%" />
              </div>
              <p className="font-mono text-[10px] text-[#7a8ba5] uppercase tracking-wider">Local & Verified</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll Cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-60">
          <span className="font-mono text-[10px] tracking-widest text-[#7a8ba5] uppercase">Explore Platform</span>
          <ChevronDown className="size-4 text-cyan-400 animate-bounce" />
        </div>
      </motion.section>

      {/* ── PROJECT OVERVIEW SECTION ── */}
      <section id="overview" className="relative py-28 px-6 border-t border-cyan-500/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="font-mono text-xs tracking-[0.25em] text-cyan-400 uppercase font-bold">
              // ARCHITECTURE ESSENTIALS
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white mt-3 tracking-wide">
              WHAT IS THIS <span className="neon-text">PLATFORM</span>?
            </h2>
            <p className="font-mono text-sm text-[#7a8ba5] mt-4 max-w-2xl mx-auto leading-relaxed">
              Enterprise engineering teams struggle with fragmented data stacks: disparate ML experiments, unmonitored streaming feeds, and siloed executive reporting. This project brings them together under a single unified architecture.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TiltCard>
              <div className="cyber-card p-8 h-full">
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 w-fit mb-5">
                  <Database className="size-6" />
                </div>
                <h3 className="font-display text-base font-bold text-white mb-2 tracking-wider">
                  1. Unified Ingestion & Profiling
                </h3>
                <p className="font-mono text-xs text-[#7a8ba5] leading-relaxed">
                  Upload CSV, Excel, or JSON datasets or hook into relational databases. Instant statistical profiling generates column types, missing value heatmaps, and PCA decompositions without external ETL scripts.
                </p>
              </div>
            </TiltCard>

            <TiltCard>
              <div className="cyber-card p-8 h-full">
                <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 w-fit mb-5">
                  <Brain className="size-6" />
                </div>
                <h3 className="font-display text-base font-bold text-white mb-2 tracking-wider">
                  2. Automated MLOps Engine
                </h3>
                <p className="font-mono text-xs text-[#7a8ba5] leading-relaxed">
                  Train Scikit-Learn models with median imputation and stratified splits. Benchmark all 6 algorithms simultaneously, inspect real-time confusion matrices, and run sub-millisecond inference on deployed models.
                </p>
              </div>
            </TiltCard>

            <TiltCard>
              <div className="cyber-card p-8 h-full">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit mb-5">
                  <Activity className="size-6" />
                </div>
                <h3 className="font-display text-base font-bold text-white mb-2 tracking-wider">
                  3. Real-Time Telemetry & AI
                </h3>
                <p className="font-mono text-xs text-[#7a8ba5] leading-relaxed">
                  Streaming event feeds simulate live production traffic. Automated statistical Z-scores identify anomalies and invoke our AI root-cause diagnosis engine to explain system incidents in plain English.
                </p>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ── STEP-BY-STEP END-TO-END PIPELINE ── */}
      <section id="pipeline" className="relative py-28 px-6 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="font-mono text-xs tracking-[0.25em] text-cyan-400 uppercase font-bold">
              // HOW IT WORKS
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white mt-3 tracking-wide">
              END-TO-END <span className="neon-text">ANALYTICS PIPELINE</span>
            </h2>
            <p className="font-mono text-sm text-[#7a8ba5] mt-3 max-w-xl mx-auto">
              From raw telemetry files to production ML inference and executive reports in 6 structured stages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.step}
                  className="cyber-card p-7 flex flex-col justify-between hover:border-cyan-500/30 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-display text-3xl font-black text-cyan-400/40">
                        {step.step}
                      </span>
                      <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold uppercase tracking-wider">
                        {step.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 mb-2">
                      <Icon className="size-5 text-cyan-400" />
                      <h3 className="font-display text-sm font-bold text-white tracking-wide">
                        {step.title}
                      </h3>
                    </div>

                    <p className="font-mono text-xs text-[#7a8ba5] leading-relaxed mt-2">
                      {step.desc}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-cyan-500/10 flex items-center justify-between text-cyan-400 font-mono text-[11px]">
                    <span className="text-[#7a8ba5]">Automated Execution</span>
                    <CheckCircle2 className="size-3.5 text-cyan-400" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CORE SYSTEM MODULES ── */}
      <section id="modules" className="relative py-28 px-6 border-t border-cyan-500/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="font-mono text-xs tracking-[0.25em] text-cyan-400 uppercase font-bold">
              // CAPABILITIES IN ACTION
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white mt-3 tracking-wide">
              SYSTEM <span className="neon-text">MODULES</span>
            </h2>
            <p className="font-mono text-sm text-[#7a8ba5] mt-3 max-w-lg mx-auto">
              Explore the individual engines powering the workspace once you sign in.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES.map((mod) => {
              const Icon = mod.icon
              return (
                <div key={mod.id} className="cyber-card p-7 group hover:border-cyan-500/30 transition-all">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${mod.color} border border-white/5 w-fit mb-5`}>
                    <Icon className="size-6 text-cyan-400" />
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display text-base font-bold text-white tracking-wide">{mod.title}</h3>
                    <span className="font-mono text-[10px] text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-500/10">
                      {mod.stat}
                    </span>
                  </div>

                  <p className="font-mono text-xs text-[#7a8ba5] leading-relaxed mb-6">{mod.desc}</p>

                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-cyan-400 hover:text-cyan-300 font-bold tracking-wider uppercase group-hover:translate-x-1 transition-transform"
                  >
                    <span>Access Module</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SAMPLE DATASETS SHOWCASE ── */}
      <section id="datasets" className="relative py-28 px-6 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent border-t border-cyan-500/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="font-mono text-xs tracking-[0.25em] text-cyan-400 uppercase font-bold">
              // READY-TO-TEST BENCHMARKS
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white mt-3 tracking-wide">
              BUILT-IN <span className="neon-text">SAMPLE DATASETS</span>
            </h2>
            <p className="font-mono text-sm text-[#7a8ba5] mt-3 max-w-xl mx-auto">
              No need to scramble for test data. The system comes pre-loaded with verified benchmark datasets ready for training.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_DATASETS.map((ds) => (
              <div key={ds.name} className="cyber-card p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold uppercase">
                      {ds.type}
                    </span>
                    <span className="font-mono text-xs text-[#7a8ba5]">
                      {ds.rows} Rows × {ds.cols} Cols
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-white mb-2 tracking-wide">{ds.name}</h3>
                  <p className="font-mono text-xs text-[#7a8ba5] leading-relaxed mb-4">{ds.desc}</p>
                </div>

                <div className="pt-4 border-t border-cyan-500/10 flex items-center justify-between font-mono text-xs">
                  <span className="text-[#7a8ba5]">Target: <strong className="text-white">{ds.target}</strong></span>
                  <Link to="/login" className="text-cyan-400 hover:underline flex items-center gap-1 font-bold">
                    Train Model <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Start Steps Callout */}
          <div className="mt-12 p-6 rounded-2xl border border-cyan-500/15 bg-black/40 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Terminal className="size-6" />
              </div>
              <div>
                <h4 className="font-display text-sm font-bold text-white">How to Get Started in 60 Seconds</h4>
                <p className="font-mono text-xs text-[#7a8ba5] mt-0.5">
                  1. Create an account &nbsp;→&nbsp; 2. Go to Model Training &nbsp;→&nbsp; 3. Pick Iris & Click Train &nbsp;→&nbsp; 4. Test Predictions!
                </p>
              </div>
            </div>

            <Link to="/register">
              <button type="button" className="btn btn-neon-solid btn-md shrink-0">
                CREATE OPERATOR ACCOUNT <ArrowRight className="size-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE TECH STACK ── */}
      <section id="architecture" className="relative py-28 px-6 border-t border-cyan-500/10">
        <div className="max-w-5xl mx-auto text-center">
          <span className="font-mono text-xs tracking-[0.25em] text-cyan-400 uppercase font-bold">
            // UNDER THE HOOD
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-white mt-3 tracking-wide">
            ENTERPRISE-GRADE <span className="neon-text">STACK</span>
          </h2>
          <p className="font-mono text-sm text-[#7a8ba5] mt-3 max-w-lg mx-auto">
            Built with modern standards for real-time reactivity, rock-solid security, and sub-second execution.
          </p>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {[
              { title: 'FastAPI', desc: 'Async Python 3.13', icon: Zap },
              { title: 'React 19', desc: 'Vite & Framer Motion', icon: Cpu },
              { title: 'Scikit-Learn', desc: 'Ensemble ML Models', icon: Brain },
              { title: 'Kafka Stream', desc: 'Streaming Simulation', icon: Radio },
              { title: 'SQLite / DB', desc: 'ACID Persistent Store', icon: Database },
              { title: 'JWT & RBAC', desc: 'Zero-Trust Security', icon: ShieldCheck },
            ].map((tech) => {
              const Icon = tech.icon
              return (
                <div
                  key={tech.title}
                  className="p-5 rounded-2xl border border-cyan-500/10 bg-black/40 flex flex-col items-center text-center group hover:border-cyan-500/30 transition-all"
                >
                  <Icon className="size-6 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-display text-xs font-bold text-white tracking-wider">{tech.title}</h4>
                  <p className="font-mono text-[10px] text-[#7a8ba5] mt-0.5">{tech.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── GRAND CTA BANNER ── */}
      <section className="relative py-32 px-6 border-t border-cyan-500/10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center relative"
        >
          <div className="relative p-12 sm:p-16 rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/[0.04] to-transparent overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.06)]">
            <div className="scanner-overlay absolute inset-0 pointer-events-none" />

            <Sparkles className="size-10 text-cyan-400/60 mx-auto mb-5 animate-pulse" />
            <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-wide mb-4">
              READY TO LAUNCH YOUR <span className="neon-text">WORKSPACE</span>?
            </h2>
            <p className="font-mono text-sm text-[#7a8ba5] max-w-lg mx-auto mb-10 leading-relaxed">
              Step into the unified control center. Train models, monitor anomalies, stream real-time events, and generate intelligence reports.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn btn-neon-solid btn-xl group w-full sm:w-auto"
                >
                  <span>CREATE ACCOUNT</span>
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn btn-neon btn-xl w-full sm:w-auto"
                >
                  <span>OPERATOR SIGN IN</span>
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 px-6 border-t border-cyan-500/10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/15 text-cyan-400">
              <Cpu className="size-4" />
            </div>
            <span className="font-display text-sm font-bold text-white tracking-wider">
              ENTERPRISE AI PLATFORM
            </span>
          </div>

          <p className="font-mono text-xs text-[#3a4558] tracking-wider text-center">
            © {new Date().getFullYear()} UNIFIED ENTERPRISE AI ANALYTICS — ALL SYSTEMS OPERATIONAL
          </p>

          <div className="flex items-center gap-4">
            <Link to="/login" className="font-mono text-xs text-[#7a8ba5] hover:text-cyan-400 transition uppercase tracking-wider">
              Sign In
            </Link>
            <span className="text-[#3a4558]">/</span>
            <Link to="/register" className="font-mono text-xs text-[#7a8ba5] hover:text-cyan-400 transition uppercase tracking-wider">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
