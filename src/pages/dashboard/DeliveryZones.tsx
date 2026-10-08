import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  MapPin, Plus, Edit3, Trash2, Loader2, X, Save, Clock, DollarSign,
  CircleDot, ListChecks, MapPinned, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { apiWithTenant } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

type ZoneType = 'radius' | 'cep' | 'neighborhood'

interface DeliveryZone {
  id: string
  name: string
  zoneType: ZoneType
  fee: number
  estimatedTime: number
  minOrder: number | null
  radiusKm: number | null
  cepList: string | null
  neighborhoodList: string | null
  priority: number
  isActive: boolean
}

const ZONE_TYPE_LABELS: Record<ZoneType, { label: string; description: string; icon: any }> = {
  radius: {
    label: 'Raio de distância',
    description: 'Define área por km a partir do endereço da loja',
    icon: MapPinned,
  },
  cep: {
    label: 'Lista de CEPs',
    description: 'Cobertura para CEPs específicos',
    icon: ListChecks,
  },
  neighborhood: {
    label: 'Bairros',
    description: 'Cobertura para bairros específicos',
    icon: MapPin,
  },
}

const emptyForm: Omit<DeliveryZone, 'id'> = {
  name: '',
  zoneType: 'radius',
  fee: 5,
  estimatedTime: 60,
  minOrder: 0,
  radiusKm: 5,
  cepList: '',
  neighborhoodList: '',
  priority: 0,
  isActive: true,
}

export function DeliveryZones() {
  const { user } = useAuth()
  const tenantSlug = getTenantSlug(user)

  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<DeliveryZone | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadZones()
  }, [])

  const loadZones = async () => {
    setLoading(true)
    try {
      const resp = await apiWithTenant<{ zones: DeliveryZone[] }>('/delivery-zones', tenantSlug)
      setZones(resp.zones || [])
    } catch (err) {
      toast.error('Erro ao carregar áreas de entrega')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, priority: zones.length + 1 })
    setShowModal(true)
  }

  const openEdit = (zone: DeliveryZone) => {
    setEditing(zone)
    setForm({
      name: zone.name,
      zoneType: zone.zoneType,
      fee: zone.fee,
      estimatedTime: zone.estimatedTime,
      minOrder: zone.minOrder,
      radiusKm: zone.radiusKm,
      cepList: zone.cepList || '',
      neighborhoodList: zone.neighborhoodList || '',
      priority: zone.priority,
      isActive: zone.isActive,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome da área')
      return
    }

    if (form.zoneType === 'radius' && (!form.radiusKm || form.radiusKm <= 0)) {
      toast.error('Informe o raio em km')
      return
    }

    if (form.zoneType === 'cep' && !form.cepList?.trim()) {
      toast.error('Informe ao menos um CEP')
      return
    }

    if (form.zoneType === 'neighborhood' && !form.neighborhoodList?.trim()) {
      toast.error('Informe ao menos um bairro')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        radiusKm: form.zoneType === 'radius' ? form.radiusKm : null,
        cepList: form.zoneType === 'cep' ? form.cepList : null,
        neighborhoodList: form.zoneType === 'neighborhood' ? form.neighborhoodList : null,
      }

      if (editing) {
        await apiWithTenant(`/delivery-zones/${editing.id}`, tenantSlug, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast.success('Área atualizada!')
      } else {
        await apiWithTenant('/delivery-zones', tenantSlug, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Área criada!')
      }
      setShowModal(false)
      loadZones()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta área?')) return
    setDeleting(id)
    try {
      await apiWithTenant(`/delivery-zones/${id}`, tenantSlug, { method: 'DELETE' })
      toast.success('Área removida')
      loadZones()
    } catch {
      toast.error('Erro ao remover')
    } finally {
      setDeleting(null)
    }
  }

  const handleToggle = async (zone: DeliveryZone) => {
    try {
      await apiWithTenant(`/delivery-zones/${zone.id}`, tenantSlug, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !zone.isActive }),
      })
      loadZones()
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  const formatList = (text: string | null) => {
    if (!text) return []
    return text.split(',').map((s) => s.trim()).filter(Boolean)
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Áreas de Entrega</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Defina diferentes zonas com taxas e prazos específicos
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-colors"
        >
          <Plus className="w-5 h-5" /> Nova Área
        </button>
      </div>

      {/* Info banner */}
      {zones.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-blue-800 dark:text-blue-300">Crie sua primeira área de entrega</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Você pode definir áreas por raio de distância, lista de CEPs ou bairros. Cada área tem sua própria taxa e prazo estimado.
                Se nenhuma área corresponder ao endereço do cliente, será usada a taxa padrão da loja.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Zones grid */}
      {zones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {zones.map((zone, i) => {
            const typeInfo = ZONE_TYPE_LABELS[zone.zoneType]
            const Icon = typeInfo.icon
            return (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-white dark:bg-[#121214] border rounded-2xl p-5 transition-all ${
                  zone.isActive
                    ? 'border-slate-200 dark:border-[#262626]'
                    : 'border-slate-200 dark:border-[#262626] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      zone.isActive
                        ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                        : 'bg-slate-100 dark:bg-slate-500/10 text-slate-400'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{zone.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{typeInfo.label}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(zone)}
                    className="shrink-0"
                    title={zone.isActive ? 'Desativar' : 'Ativar'}
                  >
                    {zone.isActive ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Taxa
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      R$ {Number(zone.fee).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Tempo estimado
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{zone.estimatedTime} min</span>
                  </div>
                  {zone.minOrder != null && Number(zone.minOrder) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Pedido mínimo</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        R$ {Number(zone.minOrder).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-[#262626] pt-3 mb-3">
                  {zone.zoneType === 'radius' && zone.radiusKm && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <CircleDot className="w-3 h-3 inline mr-1" />
                      Até {Number(zone.radiusKm).toFixed(1)} km de distância
                    </p>
                  )}
                  {zone.zoneType === 'cep' && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <p className="font-medium mb-1">CEPs cobertos:</p>
                      <div className="flex flex-wrap gap-1">
                        {formatList(zone.cepList).slice(0, 5).map((cep, j) => (
                          <span key={j} className="px-2 py-0.5 bg-slate-100 dark:bg-[#262626] rounded text-[10px]">
                            {cep}
                          </span>
                        ))}
                        {formatList(zone.cepList).length > 5 && (
                          <span className="text-[10px] text-slate-400">
                            +{formatList(zone.cepList).length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {zone.zoneType === 'neighborhood' && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <p className="font-medium mb-1">Bairros cobertos:</p>
                      <div className="flex flex-wrap gap-1">
                        {formatList(zone.neighborhoodList).slice(0, 3).map((n, j) => (
                          <span key={j} className="px-2 py-0.5 bg-slate-100 dark:bg-[#262626] rounded text-[10px]">
                            {n}
                          </span>
                        ))}
                        {formatList(zone.neighborhoodList).length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{formatList(zone.neighborhoodList).length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(zone)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-lg transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(zone.id)}
                    disabled={deleting === zone.id}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting === zone.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-[#18181B] border-b border-slate-200 dark:border-[#262626] p-5 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editing ? 'Editar Área' : 'Nova Área de Entrega'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nome da área
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Centro, Zona Norte, Bairro X"
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Tipo de área
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(Object.keys(ZONE_TYPE_LABELS) as ZoneType[]).map((t) => {
                      const info = ZONE_TYPE_LABELS[t]
                      const Icon = info.icon
                      return (
                        <button
                          key={t}
                          onClick={() => setForm({ ...form, zoneType: t })}
                          className={`p-3 rounded-xl border-2 text-left transition-colors ${
                            form.zoneType === t
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                              : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mb-1 ${form.zoneType === t ? 'text-orange-500' : 'text-slate-400'}`} />
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{info.label}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Type-specific fields */}
                {form.zoneType === 'radius' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Raio máximo (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.radiusKm || ''}
                      onChange={(e) => setForm({ ...form, radiusKm: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Configure a latitude/longitude da loja na página "Minha Loja" para usar este tipo
                    </p>
                  </div>
                )}

                {form.zoneType === 'cep' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      CEPs cobertos (separados por vírgula)
                    </label>
                    <textarea
                      value={form.cepList || ''}
                      onChange={(e) => setForm({ ...form, cepList: e.target.value })}
                      placeholder="01310-100, 01310-200, 01311-000"
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Você pode usar CEPs exatos ou prefixos (ex: "01310" cobre toda a região)
                    </p>
                  </div>
                )}

                {form.zoneType === 'neighborhood' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Bairros cobertos (separados por vírgula)
                    </label>
                    <textarea
                      value={form.neighborhoodList || ''}
                      onChange={(e) => setForm({ ...form, neighborhoodList: e.target.value })}
                      placeholder="Centro, Jardins, Vila Mariana"
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      O sistema busca pelo nome do bairro no endereço do cliente
                    </p>
                  </div>
                )}

                {/* Fee and Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Taxa de entrega (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.fee}
                      onChange={(e) => setForm({ ...form, fee: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Tempo estimado (min)
                    </label>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={form.estimatedTime}
                      onChange={(e) => setForm({ ...form, estimatedTime: parseInt(e.target.value) || 60 })}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Min order */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pedido mínimo (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minOrder || ''}
                    onChange={(e) => setForm({ ...form, minOrder: parseFloat(e.target.value) || 0 })}
                    placeholder="0 = sem mínimo"
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Active */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#09090b] rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Área ativa</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Áreas inativas não aparecem no checkout</p>
                  </div>
                  <button
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      form.isActive ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        form.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-[#18181B] border-t border-slate-200 dark:border-[#262626] p-5 flex items-center gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-[#3f3f46] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
