import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { apiClient } from '../lib/api'

const schema = z.object({
  email: z.email(),
  full_name: z.string().min(2),
  password: z.string().min(8),
})
type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    await apiClient.post('/auth/register', values)
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <div className="mt-4 space-y-4">
          <input {...register('full_name')} placeholder="Full name" className="w-full rounded-lg border border-white/20 bg-slate-950/70 p-3" />
          <input {...register('email')} placeholder="Email" className="w-full rounded-lg border border-white/20 bg-slate-950/70 p-3" />
          <input {...register('password')} type="password" placeholder="Password" className="w-full rounded-lg border border-white/20 bg-slate-950/70 p-3" />
          <button type="submit" disabled={formState.isSubmitting} className="w-full rounded-lg bg-violet-500 p-3 font-medium">
            {formState.isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          Already have an account? <Link to="/login" className="text-violet-300">Sign in</Link>
        </p>
      </form>
    </div>
  )
}

