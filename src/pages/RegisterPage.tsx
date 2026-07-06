import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../lib/api'

import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { ThemeProvider } from '../contexts/ThemeContext'

function RegisterPageInner() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const inviteToken = searchParams.get('invite')

  useEffect(() => {
    if (!inviteToken) {
      setStep('error')
      setError('Link de convite inválido')
      return
    }
    setStep('form')
  }, [inviteToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      setError('Preencha todos os campos')
      return
    }
    if (form.password.length < 4) {
      setError('Senha muito curta')
      return
    }
    setLoading(true); setError('')

    try {
      const data = await api<{ user: any; token: string }>('/auth/register-tenant', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          tenantName: form.name + ' - Loja',
          slug: 'loja-' + Date.now().toString(36),
          inviteToken,
        }),
      })
      login(data.token, data.user)
      setStep('success')
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar')
    } finally { setLoading(false) }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b] px-4">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Conta criada!</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Você foi adicionado à equipe. Redirecionando...</p>
        </div>
      </div>
    )
  }

  if (step === 'error' && !inviteToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b] px-4">
        <div className="text-center max-w-sm">
          <XCircle className="w-14 h-14 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Link inválido</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-white">MF</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Aceitar Convite</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Você foi convidado para fazer parte de uma equipe
          </p>
        </div>

        <form onSubmit={handleSubmit}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Seu nome completo"
              className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="seu@email.com" autoFocus
              className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 4 caracteres"
              className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 text-center">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? 'Criando conta...' : 'Aceitar e Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function RegisterPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RegisterPageInner />
      </AuthProvider>
    </ThemeProvider>
  )
}
