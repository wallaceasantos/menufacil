import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search, Clock, CheckCircle2, ChefHat, Loader2, ArrowLeft,
  Phone, MapPin, DollarSign, ShoppingBag, ExternalLink, UtensilsCrossed,
  Star, RotateCcw, QrCode, Share2, Copy, Check,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const STORAGE_KEY = 'menufacil_tracking_phone'

const STATUS_STEPS = [
  { key: 'pending', label: 'Recebido', icon: Clock, desc: 'Seu pedido foi recebido e será preparado em breve' },
  { key: 'preparing', label: 'Preparando', icon: ChefHat, desc: 'O restaurante está preparando seu pedido' },
  { key: 'completed', label: 'Pronto!', icon: CheckCircle2, desc: 'Seu pedido está pronto. Bom apetite!' },
]
const ORDER = ['pending', 'preparing', 'completed']

function idx(s: string) { return s === 'cancelled' ? -1 : ORDER.indexOf(s) }

function fmt(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}` }
function fmtDate(d: string) { return new Date(d).toLocaleString('pt-BR') }

interface OrderData {
  id: string
  shortId: string
  customerName: string
  customerPhone: string
  status: string
  total: number
  paymentMethod: string
  deliveryAddress: string
  createdAt: string
  items: Array<{ name: string; quantity: number; unitPrice: number; notes: string | null; components: Array<{ name: string; quantity: number }>; choices: Array<{ group: string; option: string }> }>
  storeName: string
  storePhone: string
  storeLogo: string | null
  storeBanner: string | null
  storeSlug: string
  rating: number | null
  ratingComment: string | null
  pixPayload?: string | null
  pixQrCode?: string | null
  mpPaymentStatus?: string | null
}

interface LookupOrder {
  id: string; shortId: string; customerName: string; status: string
  total: number; paymentMethod: string; deliveryAddress: string
  itemsSummary: string; createdAt: string
}

export function TrackingPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>()
  const [sp] = useSearchParams()

  const [step, setStep] = useState<'lookup' | 'list' | 'tracking'>('lookup')
  const [phone, setPhone] = useState(localStorage.getItem(STORAGE_KEY) || '')
  const [orderId, setOrderId] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<LookupOrder[]>([])
  const [order, setOrder] = useState<OrderData | null>(null)
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [ratingSent, setRatingSent] = useState(false)
  const [ratingComment, setRatingComment] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    return () => { esRef.current?.close() }
  }, [])

  useEffect(() => {
    const oid = sp.get('orderId')
    if (oid) {
      setSearching(true)
      fetch(`${API_BASE}/loja/${storeSlug}/track/${oid}`)
        .then((r) => r.json())
        .then((d: OrderData) => { setOrder(d); setStep('tracking'); connectSSE(oid) })
        .catch(() => toast.error('Pedido não encontrado'))
        .finally(() => setSearching(false))
    }
  }, [storeSlug, sp])

  const connectSSE = (oid: string) => {
    esRef.current?.close()
    const es = new EventSource(`${API_BASE}/loja/${storeSlug}/track/${oid}/stream`)
    esRef.current = es
    es.addEventListener('status_update', (e) => {
      try { setLiveStatus(JSON.parse(e.data).status) } catch {}
    })
    es.onerror = () => { es.close(); esRef.current = null }
  }

  const handleLookup = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) { setError('Digite um telefone válido'); return }
    setSearching(true); setError('')
    try {
      const resp = await fetch(`${API_BASE}/loja/${storeSlug}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, orderId: orderId.replace(/^#/, '').trim() || undefined }),
      })
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || 'Nenhum pedido')
      const data = await resp.json()
      localStorage.setItem(STORAGE_KEY, phone)
      if (data.orders?.length === 1) {
        await viewOrder(data.orders[0].id)
      } else {
        setResults(data.orders || []); setStep('list')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar')
    } finally { setSearching(false) }
  }

  const viewOrder = async (id: string) => {
    setSearching(true); setError('')
    try {
      const resp = await fetch(`${API_BASE}/loja/${storeSlug}/track/${id}`)
      if (!resp.ok) throw new Error('Pedido não encontrado')
      const d: OrderData = await resp.json()
      setOrder(d); setStep('tracking'); connectSSE(id)
      setRating(d.rating || 0); setRatingSent(!!d.rating)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally { setSearching(false) }
  }

  const goBack = () => { esRef.current?.close(); esRef.current = null; setStep('lookup'); setOrder(null); setLiveStatus(null); setOrderId('') }

  const currentStatus = liveStatus || order?.status || 'pending'
  const statusIdx = idx(currentStatus)
  const cancelled = currentStatus === 'cancelled'
  const trackingUrl = order ? `${window.location.origin}/rastrear/${storeSlug}?orderId=${order.id}` : ''

  const copyLink = () => {
    navigator.clipboard.writeText(trackingUrl)
    setCopied(true); toast.success('Link copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({ title: `Pedido ${order?.shortId}`, text: `Acompanhe meu pedido no ${order?.storeName}`, url: trackingUrl })
    } else { copyLink() }
  }

  const reorderLink = order ? `${window.location.origin}/loja/${storeSlug}` : ''

  const submitRating = async (stars: number) => {
    if (!order || ratingSent) return
    setRating(stars); setRatingSent(true)
    try {
      await fetch(`${API_BASE}/loja/${storeSlug}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, rating: stars, comment: ratingComment }),
      })
      toast.success(`Avaliação ${stars} estrela${stars > 1 ? 's' : ''} enviada! ⭐`)
    } catch {
      toast.error('Erro ao enviar avaliação')
    }
  }

  if (searching && !order) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex flex-col">
      <header className="bg-white dark:bg-[#121214] border-b border-slate-200 dark:border-[#262626] sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          {step !== 'lookup' && (
            <button onClick={goBack} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626]">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {order?.storeLogo ? (
              <img src={order.storeLogo} className="w-7 h-7 rounded-lg object-cover" alt="" />
            ) : (
              <div className="w-7 h-7 bg-orange-600 rounded-lg flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {order?.storeName || 'Acompanhar Pedido'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 pb-24">
        <div className="w-full max-w-md space-y-4">
          <AnimatePresence mode="wait">
            {/* LOOKUP */}
            {step === 'lookup' && (
              <motion.div key="lookup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-6 shadow-xl space-y-4 mt-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-100 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Search className="w-7 h-7 text-orange-500" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Acompanhar Pedido</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Digite o telefone usado no pedido</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">WhatsApp</label>
                  <input
                    type="text" value={formatPhone(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-2xl p-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nº do pedido <span className="font-normal">(opcional)</span></label>
                  <input
                    type="text" value={orderId}
                    onChange={(e) => setOrderId(e.target.value.replace(/^#/, ''))}
                    placeholder="Primeiras letras do pedido"
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-2xl p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-3 text-sm text-red-700 dark:text-red-300 text-center">{error}</div>}

                <button onClick={handleLookup} disabled={searching}
                  className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                  {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  {searching ? 'Buscando...' : 'Buscar Pedidos'}
                </button>
              </motion.div>
            )}

            {/* LIST */}
            {step === 'list' && (
              <motion.div key="list" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-3 mt-8">
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-5 shadow-xl">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Seus Pedidos</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Selecione um para acompanhar</p>
                </div>
                {results.map((o) => (
                  <button key={o.id} onClick={() => viewOrder(o.id)}
                    className="w-full text-left bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-4 shadow-sm hover:border-orange-300 transition-colors space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{o.shortId}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-slate-400">{fmtDate(o.createdAt)}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{o.itemsSummary}</p>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-500">{fmt(o.total)}</p>
                  </button>
                ))}
              </motion.div>
            )}

            {/* TRACKING */}
            {step === 'tracking' && order && (
              <motion.div key="tracking" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 mt-4">
                {/* Banner */}
                {order.storeBanner && (
                  <div className="rounded-3xl overflow-hidden shadow-lg max-h-32">
                    <img src={order.storeBanner} className="w-full h-32 object-cover" alt="" />
                  </div>
                )}

                {/* Order header */}
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{order.shortId}</h2>
                      <p className="text-xs text-slate-400">{fmtDate(order.createdAt)}</p>
                    </div>
                    <StatusBadge status={currentStatus} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Olá, <strong>{order.customerName}</strong>!</p>
                </div>

                {/* PIX QR Code - if payment pending */}
                {(order.mpPaymentStatus === 'pending' && order.pixPayload) || order.pixQrCode ? (
                  <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-5 shadow-xl text-center">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Pagamento PIX</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Escaneie o QR Code para pagar</p>
                    {order.pixQrCode ? (
                      <img src={`data:image/png;base64,${order.pixQrCode}`} alt="QR Code PIX" className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl border border-slate-200 mb-3" />
                    ) : (
                      <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl border border-slate-200 mb-3 flex items-center justify-center">
                        <p className="text-xs text-slate-400">QR Code não disponível</p>
                      </div>
                    )}
                    {order.pixPayload && (
                      <div className="flex items-center gap-2 max-w-full">
                        <input readOnly value={order.pixPayload} className="flex-1 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg p-2 text-[10px] text-slate-500 font-mono truncate" />
                        <button onClick={() => { navigator.clipboard.writeText(order.pixPayload!); toast.success('PIX copiado!') }}
                          className="p-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors shrink-0">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-3">Aguardando pagamento...</p>
                    {window.location.hostname === 'localhost' && (
                      <button
                        onClick={async () => {
                          await fetch(`${API_BASE}/loja/${storeSlug}/pix/simulate`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId: order.id }),
                          })
                          setLiveStatus(order.status)
                          toast.success('Pagamento simulado! Recarregando...')
                          setTimeout(() => viewOrder(order.id), 1500)
                        }}
                        className="mt-2 text-[10px] text-orange-600 hover:text-orange-500 underline font-medium">
                        Simular Pagamento PIX (dev)
                      </button>
                    )}
                  </div>
                ) : null}
                {order.mpPaymentStatus === 'approved' ? (
                  <div className="bg-white dark:bg-[#121214] border border-emerald-200 dark:border-emerald-500/20 rounded-3xl p-5 shadow-xl text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-emerald-700 dark:text-emerald-400">Pagamento Confirmado!</h3>
                    <p className="text-xs text-slate-500 mt-1">Seu PIX foi aprovado</p>
                  </div>
                ) : null}

                {/* Timeline */}
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-6 shadow-xl overflow-hidden">
                  {cancelled ? (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-red-600 dark:text-red-500">Pedido Cancelado</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">O estabelecimento cancelou este pedido</p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white mb-5">Status do seu pedido</h3>
                      <div className="space-y-0">
                        {STATUS_STEPS.map((s, i) => {
                          const Icon = s.icon
                          const done = statusIdx >= i
                          const curr = statusIdx === i
                          return (
                            <div key={s.key} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <motion.div
                                  animate={curr && liveStatus ? { scale: [1, 1.1, 1] } : {}}
                                  transition={{ repeat: Infinity, duration: 1.5 }}
                                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                                    done ? (curr ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-500 shadow-lg shadow-orange-500/10' : curr ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-500' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500') : 'bg-slate-100 dark:bg-[#262626] text-slate-400'
                                  }`}>
                                    {curr && liveStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-5 h-5" />}
                                  </motion.div>
                                  {i < STATUS_STEPS.length - 1 && (
                                    <div className="relative w-0.5 h-16">
                                      <div className="absolute inset-0 bg-slate-200 dark:bg-[#262626] rounded-full" />
                                      {done && i < statusIdx && (
                                        <motion.div initial={{ height: '0%' }} animate={{ height: '100%' }} transition={{ duration: 0.8 }}
                                          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-orange-500 to-emerald-500 rounded-full" />
                                      )}
                                      {curr && <motion.div initial={{ height: '0%' }} animate={{ height: '40%' }} transition={{ duration: 0.4 }} className="absolute top-0 left-0 right-0 bg-orange-500 rounded-full" />}
                                    </div>
                                  )}
                                </div>
                              <div className="pb-4 pt-1">
                                <p className={`text-sm font-bold ${done ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{s.label}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.desc}</p>
                                {curr && <p className="text-[10px] font-bold text-orange-500 mt-1 animate-pulse uppercase tracking-wider">Agora</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Progress bar summary */}
                      <div className="mt-4 bg-slate-100 dark:bg-[#09090b] rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-[#262626] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${Math.max(0, ((statusIdx + 1) / STATUS_STEPS.length) * 100)}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full"
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{statusIdx + 1}/{STATUS_STEPS.length}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center">
                          {statusIdx === 0 ? '⏳ Aguardando início do preparo' : statusIdx === 1 ? '🔥 Seu pedido está sendo preparado' : '✅ Pedido pronto para retirada/entrega'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order details */}
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-5 shadow-xl space-y-3">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-orange-500" /> Itens
                  </h3>
                  <div className="space-y-2">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">{item.quantity}x {item.name}</span>
                        <span className="font-medium text-slate-900 dark:text-white">{fmt(item.quantity * item.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 dark:border-[#262626] pt-3 flex justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">Total</span>
                    <span className="text-xl font-extrabold text-orange-600 dark:text-orange-500">{fmt(order.total)}</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <DollarSign className="w-3 h-3" /> {order.paymentMethod}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3 h-3" /> {order.deliveryAddress}
                    </div>
                  </div>
                </div>

                {/* QR Code share */}
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-orange-500" /> Compartilhar
                    </h3>
                    <button onClick={() => setShowQR(!showQR)} className="text-xs font-medium text-orange-600 hover:text-orange-500 flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5" /> QR Code
                    </button>
                  </div>
                  {showQR && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-3 flex justify-center">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingUrl)}`}
                          alt="QR Code rastreio"
                          className="w-36 h-36"
                        />
                      </div>
                    </motion.div>
                  )}
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl px-3 py-2 text-xs text-slate-600 dark:text-slate-300 font-mono truncate">
                      {trackingUrl}
                    </div>
                    <button onClick={copyLink} className="p-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    {typeof navigator.share === 'function' && (
                      <button onClick={shareLink} className="p-2 bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-[#3f3f46]">
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Rating */}
                {currentStatus === 'completed' && (
                  <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-5 shadow-xl text-center">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">{ratingSent ? 'Obrigado! ❤️' : 'Avalie seu pedido'}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      {ratingSent ? 'Sua avaliação ajuda o restaurante a melhorar' : 'Como foi sua experiência?'}
                    </p>
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => submitRating(n)}
                          disabled={ratingSent}
                          className="p-1 transition-all disabled:cursor-default">
                          <Star
                            className={`w-8 h-8 transition-colors ${
                              n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 dark:text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <a href={reorderLink} className="flex items-center justify-center gap-2 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-900/20 transition-colors">
                    <RotateCcw className="w-4 h-4" /> Pedir Novamente
                  </a>
                  {order.storePhone && (
                    <a href={`https://wa.me/55${order.storePhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-green-900/20 transition-colors">
                      <Phone className="w-4 h-4" /> Falar com a Loja
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { l: string; c: string }> = {
    pending: { l: 'Pendente', c: 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
    preparing: { l: 'Preparando', c: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' },
    completed: { l: 'Concluído', c: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    cancelled: { l: 'Cancelado', c: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
  }
  const c = cfg[status] || { l: status, c: 'bg-slate-100 text-slate-500' }
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold ${c.c}`}>{c.l}</span>
}

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
}
