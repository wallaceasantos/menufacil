import { useState } from 'react'
import toast from 'react-hot-toast'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

export function TwoFactorSetup() {
  const [enabled, setEnabled] = useState(false)
  const [step, setStep] = useState<'idle' | 'setup' | 'verify'>('idle')
  const [secret, setSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const startSetup = async () => {
    setLoading(true)
    try {
      const res = await api<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' })
      setSecret(res.secret)
      setOtpauthUrl(res.otpauthUrl)
      setStep('setup')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao iniciar setup')
    } finally {
      setLoading(false)
    }
  }

  const enable = async () => {
    setLoading(true)
    try {
      await api('/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      })
      toast.success('2FA ativado com sucesso!')
      setEnabled(true)
      setStep('idle')
      setCode('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  const disable = async () => {
    setLoading(true)
    try {
      await api('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() || undefined }),
      })
      toast.success('2FA desativado.')
      setEnabled(false)
      setStep('idle')
      setCode('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desativar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Autenticação em Duas Etapas (2FA)</h2>
      <div className="bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          {enabled ? (
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {enabled
              ? 'A autenticação em duas etapas está ativa na sua conta.'
              : 'Adicione uma camada extra de segurança usando um aplicativo autenticador (Google Authenticator, Authy, etc).'}
          </p>
        </div>

        {step === 'setup' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Adicione a chave abaixo no seu aplicativo autenticador:
            </p>
            <code className="block bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-lg p-3 text-sm font-mono break-all text-slate-900 dark:text-white">
              {secret}
            </code>
            <a
              href={otpauthUrl}
              className="inline-block text-sm text-orange-600 hover:text-orange-500 font-medium"
            >
              Abrir no aplicativo autenticador →
            </a>
          </div>
        )}

        {(step === 'setup' || enabled) && (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código de verificação</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-3 py-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono"
              />
            </div>
            {step === 'setup' ? (
              <button
                onClick={enable}
                disabled={loading || code.length !== 6}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Ativar
              </button>
            ) : (
              <button
                onClick={disable}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Desativar
              </button>
            )}
          </div>
        )}

        {step === 'idle' && !enabled && (
          <button
            onClick={startSetup}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Configurar 2FA
          </button>
        )}
      </div>
    </div>
  )
}