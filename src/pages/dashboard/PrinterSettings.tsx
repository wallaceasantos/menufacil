import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Printer, Plus, Edit3, Trash2, Loader2, X, Save, Play, Settings2,
  ClipboardList, Eye, CheckCircle2, XCircle, Wifi, Usb, Cloud,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { apiWithTenant } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

interface PrinterConfig {
  id: string
  name: string
  printerType: string
  connectionType: string
  ipAddress: string | null
  port: number | null
  autoPrintNew: boolean
  autoPrintStatus: boolean
  printKitchen: boolean
  printDelivery: boolean
  charPerLine: number
  footerMessage: string | null
  isActive: boolean
}

interface PrintJob {
  id: string
  printerId: string
  printer: { name: string }
  orderId: string | null
  status: string
  printType: string
  title: string
  createdAt: string
  printedAt: string | null
}

const CONNECTION_LABELS: Record<string, { label: string; icon: any }> = {
  usb: { label: 'USB', icon: Usb },
  network: { label: 'Rede (IP)', icon: Wifi },
  cloud: { label: 'Cloud', icon: Cloud },
}

const emptyForm = {
  name: '',
  printerType: 'escpos',
  connectionType: 'usb',
  ipAddress: '',
  port: 9100,
  autoPrintNew: true,
  autoPrintStatus: true,
  printKitchen: false,
  printDelivery: false,
  charPerLine: 48,
  footerMessage: '',
  isActive: true,
}

export function PrinterSettings() {
  const { user } = useAuth()
  const slug = getTenantSlug(user)

  const [printers, setPrinters] = useState<PrinterConfig[]>([])
  const [jobs, setJobs] = useState<PrintJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PrinterConfig | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'printers' | 'jobs'>('printers')
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  useEffect(() => { loadPrinters(); loadJobs() }, [])

  const loadPrinters = async () => {
    try {
      const resp = await apiWithTenant<{ printers: PrinterConfig[] }>('/printer', slug)
      setPrinters(resp.printers || [])
    } catch { }
    finally { setLoading(false) }
  }

  const loadJobs = async () => {
    try {
      const resp = await apiWithTenant<{ jobs: PrintJob[] }>('/printer/jobs', slug)
      setJobs(resp.jobs || [])
    } catch { }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (p: PrinterConfig) => {
    setEditing(p)
    setForm({
      name: p.name, printerType: p.printerType, connectionType: p.connectionType,
      ipAddress: p.ipAddress || '', port: p.port || 9100,
      autoPrintNew: p.autoPrintNew, autoPrintStatus: p.autoPrintStatus,
      printKitchen: p.printKitchen, printDelivery: p.printDelivery,
      charPerLine: p.charPerLine, footerMessage: p.footerMessage || '', isActive: p.isActive,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome da impressora é obrigatório'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        ipAddress: form.connectionType === 'network' ? form.ipAddress : null,
        port: form.connectionType === 'network' ? form.port : 9100,
      }
      if (editing) {
        await apiWithTenant(`/printer/${editing.id}`, slug, { method: 'PATCH', body: JSON.stringify(payload) })
        toast.success('Impressora atualizada!')
      } else {
        await apiWithTenant('/printer', slug, { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Impressora adicionada!')
      }
      setShowModal(false)
      loadPrinters()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta impressora? Os jobs associados serão perdidos.')) return
    try {
      await apiWithTenant(`/printer/${id}`, slug, { method: 'DELETE' })
      loadPrinters()
      toast.success('Removida')
    } catch { toast.error('Erro ao remover') }
  }

  const handleTest = async (id: string) => {
    try {
      await apiWithTenant(`/printer/test/${id}`, slug, { method: 'POST' })
      toast.success('Teste enviado!')
      loadJobs()
    } catch { toast.error('Erro no teste') }
  }

  const handleToggle = async (p: PrinterConfig) => {
    try {
      await apiWithTenant(`/printer/${p.id}`, slug, { method: 'PATCH', body: JSON.stringify({ isActive: !p.isActive }) })
      loadPrinters()
    } catch { toast.error('Erro ao atualizar') }
  }

  const viewJob = async (id: string) => {
    try {
      const resp = await apiWithTenant<{ content: string; title: string }>(`/printer/jobs/${id}/content`, slug)
      setPreviewContent(resp.content)
      setPreviewTitle(resp.title)
    } catch { toast.error('Erro ao carregar') }
  }

  const printTypeLabels: Record<string, string> = {
    new_order: 'Novo Pedido',
    status_update: 'Status',
    kitchen: 'Cozinha',
    delivery: 'Entrega',
    test: 'Teste',
  }

  return (
    <div className="space-y-6 min-h-full bg-slate-50 dark:bg-[#09090b]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Impressão de Cupons</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure impressoras térmicas para imprimir pedidos automaticamente
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-colors">
          <Plus className="w-5 h-5" /> Nova Impressora
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'printers' as const, label: 'Impressoras', icon: Printer },
          { key: 'jobs' as const, label: 'Fila de Impressão', icon: ClipboardList },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as 'printers' | 'jobs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              tab === t.key ? 'bg-orange-600 text-white' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] text-slate-600 dark:text-slate-400'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      ) : tab === 'printers' ? (
        <>
          {printers.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626]">
              <Printer className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500 dark:text-slate-400">Nenhuma impressora configurada</p>
              <p className="text-xs text-slate-400 mt-1">Adicione uma impressora térmica compatível com ESC/POS</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {printers.map((p, i) => {
                const ConnIcon = CONNECTION_LABELS[p.connectionType]?.icon || Usb
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`bg-white dark:bg-[#121214] border rounded-2xl p-5 transition-all ${p.isActive ? 'border-slate-200 dark:border-[#262626]' : 'border-slate-200 dark:border-[#262626] opacity-60'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.isActive ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'bg-slate-100 dark:bg-slate-500/10 text-slate-400'}`}>
                          <ConnIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white">{p.name}</h3>
                          <p className="text-xs text-slate-500">{CONNECTION_LABELS[p.connectionType]?.label}</p>
                        </div>
                      </div>
                      <button onClick={() => handleToggle(p)} title={p.isActive ? 'Desativar' : 'Ativar'}>
                        {p.isActive ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-slate-400" />}
                      </button>
                    </div>

                    {p.connectionType === 'network' && p.ipAddress && (
                      <p className="text-xs text-slate-500 mb-2">IP: {p.ipAddress}:{p.port}</p>
                    )}

                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.autoPrintNew && <span className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded">Pedido novo</span>}
                      {p.autoPrintStatus && <span className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded">Status</span>}
                      {p.printKitchen && <span className="text-[10px] px-2 py-0.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded">Cozinha</span>}
                      {p.printDelivery && <span className="text-[10px] px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded">Entrega</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => handleTest(p.id)} className="flex-1 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-lg flex items-center justify-center gap-1.5">
                        <Play className="w-3.5 h-3.5" /> Testar
                      </button>
                      <button onClick={() => openEdit(p)} className="flex-1 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-lg flex items-center justify-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="py-2 px-3 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden">
          {jobs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p>Nenhum job de impressão encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-[#09090b] text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Data</th>
                    <th className="text-left px-6 py-3 font-medium">Impressora</th>
                    <th className="text-left px-6 py-3 font-medium">Tipo</th>
                    <th className="text-left px-6 py-3 font-medium">Título</th>
                    <th className="text-left px-6 py-3 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-t border-slate-100 dark:border-[#262626] hover:bg-slate-50 dark:hover:bg-[#09090b]">
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {new Date(j.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-3 text-slate-900 dark:text-white">{j.printer?.name}</td>
                      <td className="px-6 py-3">
                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-[#262626] rounded text-slate-600 dark:text-slate-300">
                          {printTypeLabels[j.printType] || j.printType}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{j.title}</td>
                      <td className="px-6 py-3">
                        <button onClick={() => viewJob(j.id)} className="text-orange-600 hover:text-orange-500 font-medium text-xs flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-[#18181B] border-b border-slate-200 dark:border-[#262626] p-5 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Editar Impressora' : 'Nova Impressora'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Impressora Cozinha"
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Conexão</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(CONNECTION_LABELS).map(([key, val]) => {
                      const Icon = val.icon
                      return (
                        <button key={key} onClick={() => setForm({ ...form, connectionType: key })}
                          className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-colors ${
                            form.connectionType === key ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                          }`}>
                          <Icon className={`w-5 h-5 ${form.connectionType === key ? 'text-orange-500' : 'text-slate-400'}`} />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{val.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {form.connectionType === 'network' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço IP</label>
                      <input type="text" value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} placeholder="192.168.0.100"
                        className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Porta</label>
                      <input type="number" value={form.port || 9100} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 9100 })}
                        className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Caracteres por linha</label>
                    <input type="number" min={24} max={80} value={form.charPerLine} onChange={(e) => setForm({ ...form, charPerLine: parseInt(e.target.value) || 48 })}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem do rodapé</label>
                    <input type="text" value={form.footerMessage} onChange={(e) => setForm({ ...form, footerMessage: e.target.value })} placeholder="Obrigado pela preferência!"
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 dark:bg-[#09090b] rounded-xl">
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Impressão automática</p>
                  {[
                    { key: 'autoPrintNew', label: 'Novo pedido recebido' },
                    { key: 'autoPrintStatus', label: 'Mudança de status' },
                    { key: 'printKitchen', label: 'Enviar para cozinha' },
                    { key: 'printDelivery', label: 'Enviar para entrega' },
                  ].map((opt) => (
                    <label key={opt.key} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-slate-600 dark:text-slate-300">{opt.label}</span>
                      <button onClick={() => setForm({ ...form, [opt.key]: !(form as any)[opt.key] })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${(form as any)[opt.key] ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(form as any)[opt.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#09090b] rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Impressora ativa</p>
                    <p className="text-xs text-slate-500">Inativas não recebem novos jobs</p>
                  </div>
                  <button onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-[#18181B] border-t border-slate-200 dark:border-[#262626] p-5 flex gap-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-[#3f3f46]">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewContent(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-[#18181B] border-b border-slate-200 dark:border-[#262626] p-5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{previewTitle}</h2>
                <button onClick={() => setPreviewContent(null)} className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5">
                <pre className="bg-slate-100 dark:bg-[#09090b] p-4 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap border border-slate-200 dark:border-[#262626]">
                  {previewContent}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
