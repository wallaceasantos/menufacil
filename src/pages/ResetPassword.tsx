import { useState, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres')
      return
    }
    if (password !== confirm) {
      toast.error('As senhas não conferem')
      return
    }
    setLoading(true)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setDone(true)
      toast.success('Senha redefinida com sucesso!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao redefinir senha'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-orange-600 dark:text-orange-400 hover:underline mb-4">
            <ArrowLeft className="w-4 h-4" /> Voltar ao início
          </Link>
          <div className="w-14 h-14 bg-orange-100 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-orange-600 dark:text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Redefinir senha</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            {done ? 'Tudo certo!' : 'Crie uma nova senha para sua conta'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-8 shadow-xl">
          {!token ? (
            <div className="text-center space-y-4">
              <p className="text-slate-700 dark:text-slate-300">
                Link de recuperação inválido ou ausente.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Solicite uma nova recuperação de senha na página de login.
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors"
              >
                Ir para o login
              </button>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-slate-700 dark:text-slate-300">
                Sua senha foi redefinida com sucesso. Você já pode entrar com a nova senha.
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors"
              >
                Ir para o login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#262626] focus:border-orange-500 focus:ring-orange-500 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-1 transition-all"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500">Mínimo de 8 caracteres</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Confirmar senha</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  className="w-full bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#262626] focus:border-orange-500 focus:ring-orange-500 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-1 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Lembrou a senha?{' '}
          <button onClick={() => navigate('/')} className="text-orange-600 dark:text-orange-400 hover:underline">
            Fazer login
          </button>
        </p>
      </div>
    </div>
  )
}

export default ResetPasswordPage