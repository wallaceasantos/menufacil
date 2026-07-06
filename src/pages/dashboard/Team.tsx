import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users, UserPlus, Shield, Trash2, Loader2, X, Check, Copy,
  Crown, ChefHat, PhoneCall, Bike, Clock, Link2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { apiWithTenant } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

interface Member {
  id: string; name: string; email: string; emailMasked: string
  tenantRole: string; role: string; isMe: boolean; createdAt: string
}

interface Invite {
  id: string; email: string; emailMasked: string; tenantRole: string
  createdAt: string; expiresAt: string
}

interface TeamData {
  members: Member[]; invites: Invite[]; myRole: string
}

const ROLE_ICONS: Record<string, any> = {
  dono: Crown, atendente: PhoneCall, cozinha: ChefHat, entregador: Bike,
}

const ROLE_LABELS: Record<string, string> = {
  dono: 'Dono', atendente: 'Atendente', cozinha: 'Cozinha', entregador: 'Entregador',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  dono: 'Acesso total a tudo',
  atendente: 'Gerencia pedidos e clientes',
  cozinha: 'Vê e atualiza status dos pedidos',
  entregador: 'Vê endereços de entrega',
}

const ROLE_OPTIONS = [
  { key: 'atendente', label: 'Atendente', desc: 'Gerencia pedidos e clientes', icon: PhoneCall },
  { key: 'cozinha', label: 'Cozinha', desc: 'Vê e atualiza status dos pedidos', icon: ChefHat },
  { key: 'entregador', label: 'Entregador', desc: 'Vê endereços de entrega', icon: Bike },
]

export function Team() {
  const { user } = useAuth()
  const slug = getTenantSlug(user)

  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('atendente')
  const [sending, setSending] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const isDono = user?.tenantRole === 'dono' || !user?.tenantRole

  useEffect(() => { loadTeam() }, [])

  const loadTeam = async () => {
    setLoading(true)
    try {
      const resp = await apiWithTenant<TeamData>('/team', slug)
      setData(resp)
    } catch { toast.error('Erro ao carregar equipe') }
    finally { setLoading(false) }
  }

  const handleInvite = async () => {
    if (!inviteEmail.includes('@')) { toast.error('Email inválido'); return }
    setSending(true)
    try {
      const resp = await apiWithTenant<{ invite: any; registerUrl: string }>('/team/invite', slug, {
        method: 'POST', body: JSON.stringify({ email: inviteEmail, tenantRole: inviteRole }),
      })
      setInviteUrl(resp.registerUrl)
      setInviteEmail('')
      toast.success('Convite criado!')
      loadTeam()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar')
    } finally { setSending(false) }
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await apiWithTenant(`/team/member/${userId}`, slug, {
        method: 'PATCH', body: JSON.stringify({ tenantRole: newRole }),
      })
      toast.success('Perfil atualizado!')
      loadTeam()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar perfil')
    }
  }

  const handleRemove = async (userId: string) => {
    if (!confirm('Remover este membro da equipe?')) return
    try {
      await apiWithTenant(`/team/member/${userId}`, slug, { method: 'DELETE' })
      toast.success('Membro removido')
      loadTeam()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover')
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await apiWithTenant(`/team/invite/${inviteId}`, slug, { method: 'DELETE' })
      toast.success('Convite cancelado')
      loadTeam()
    } catch { toast.error('Erro ao cancelar') }
  }

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true); toast.success('Link copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 min-h-full bg-slate-50 dark:bg-[#09090b]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Equipe</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie quem tem acesso ao seu painel
          </p>
        </div>
        {isDono && (
          <button onClick={() => { setShowInvite(!showInvite); setInviteUrl(''); setInviteEmail('') }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-colors">
            <UserPlus className="w-5 h-5" /> Convidar Membro
          </button>
        )}
      </div>

      {/* Invite Form */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 overflow-hidden shadow-xl">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Convidar novo membro</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input type="email" value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colaborador@email.com"
                  className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Perfil</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <button key={opt.key} type="button" onClick={() => setInviteRole(opt.key)}
                        className={`p-3 rounded-xl border-2 text-left transition-colors ${
                          inviteRole === opt.key ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                        }`}>
                        <Icon className={`w-5 h-5 mb-1 ${inviteRole === opt.key ? 'text-orange-500' : 'text-slate-400'}`} />
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{opt.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowInvite(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-[#3f3f46] transition-colors">
                  Cancelar
                </button>
                <button onClick={handleInvite} disabled={sending}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  {sending ? 'Gerando...' : 'Gerar Convite'}
                </button>
              </div>
            </div>

            {inviteUrl && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Convite gerado!</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-2">
                  Envie este link para o colaborador se cadastrar:
                </p>
                <div className="flex items-center gap-2">
                  <input readOnly value={inviteUrl}
                    className="flex-1 bg-white dark:bg-[#121214] border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-2 text-[10px] text-slate-600 font-mono truncate" />
                  <button onClick={() => copyLink(inviteUrl)}
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members list */}
      {data?.members.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.members.map((m, i) => {
            const Icon = ROLE_ICONS[m.tenantRole] || Users
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${m.isMe ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'bg-slate-100 dark:bg-slate-500/10 text-slate-500'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white">{m.name}</h3>
                        {m.isMe && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 font-bold">Você</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{m.emailMasked}</p>
                    </div>
                  </div>
                  {isDono && !m.isMe && (
                    <div className="flex items-center gap-1">
                      <select value={m.tenantRole}
                        onChange={(e) => handleChangeRole(m.id, e.target.value)}
                        className="text-[10px] bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-orange-500">
                        <option value="dono">Dono</option>
                        <option value="atendente">Atendente</option>
                        <option value="cozinha">Cozinha</option>
                        <option value="entregador">Entregador</option>
                      </select>
                      <button onClick={() => handleRemove(m.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {!isDono && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                      m.tenantRole === 'atendente' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                      m.tenantRole === 'cozinha' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' :
                      'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    }`}>
                      <Icon className="w-3 h-3" /> {ROLE_LABELS[m.tenantRole]}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">{ROLE_DESCRIPTIONS[m.tenantRole]}</p>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626]">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum membro na equipe</p>
          <p className="text-xs text-slate-400 mt-1">Convide colaboradores para acessar o painel</p>
        </div>
      )}

      {/* Pending invites */}
      {data?.invites && data.invites.length > 0 && (
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-[#262626] flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Convites Pendentes</h3>
            <span className="text-xs text-slate-500 bg-slate-100 dark:bg-[#262626] px-2 py-0.5 rounded-full">{data.invites.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#262626]">
            {data.invites.map((inv) => {
              const Icon = ROLE_ICONS[inv.tenantRole] || Users
              return (
                <div key={inv.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-500/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{inv.emailMasked}</p>
                      <p className="text-[10px] text-slate-500">
                        {ROLE_LABELS[inv.tenantRole]} · Expira {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {isDono && (
                    <button onClick={() => handleCancelInvite(inv.id)}
                      className="text-xs text-red-500 hover:text-red-600 font-medium">Cancelar</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
