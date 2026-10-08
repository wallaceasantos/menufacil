import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Store, MapPin, Clock, Upload, Camera, Save, Phone, Crown, ArrowRight, Globe, Eye, ExternalLink, CheckCircle2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { generateSlug, getTenantSlug } from '../../data/tenantStorage';
import { api, apiWithTenant, uploadImage } from '../../lib/api';
import { CurrencyInput } from '../../components/CurrencyInput';
import { extractTime } from '../../lib/time';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function StoreSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [storeData, setStoreData] = useState({
    name: 'Burger King',
    description: 'Os melhores hambúrgueres da cidade.',
    address: 'Av. Paulista, 1000 - Bela Vista',
    phone: '(11) 99999-9999',
    deliveryFee: '5.00',
    minOrder: '20.00',
    openingHours: '18:00',
    closingHours: '23:59',
  });

  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [customDomain, setCustomDomain] = useState('');
  const [domainVerified, setDomainVerified] = useState(false);
  const [domainToken, setDomainToken] = useState<string | null>(null);
  const [domainChecking, setDomainChecking] = useState(false);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainInstructions, setDomainInstructions] = useState('');

  const tenantSlug = getTenantSlug(user);

  // Carregar configurações da loja ao montar
  useEffect(() => {
    if (!user || !tenantSlug) return;

    async function loadStore() {
      try {
        const data = await apiWithTenant<{
          name: string;
          description: string | null;
          address: string | null;
          phone: string | null;
          deliveryFee: string | number | null;
          minOrder: string | number | null;
          openingHours: string | null;
          closingHours: string | null;
          logoUrl: string | null;
          bannerUrl: string | null;
        }>('/store', tenantSlug);

        setStoreData({
          name: data.name || '',
          description: data.description || '',
          address: data.address || '',
          phone: data.phone || '',
          deliveryFee: data.deliveryFee ? String(data.deliveryFee) : '0.00',
          minOrder: data.minOrder ? String(data.minOrder) : '0.00',
          openingHours: extractTime(data.openingHours),
          closingHours: extractTime(data.closingHours),
        });

        setLogo(data.logoUrl && !data.logoUrl.startsWith('blob:') ? data.logoUrl : null);
        setBanner(data.bannerUrl && !data.bannerUrl.startsWith('blob:') ? data.bannerUrl : null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar loja';
        toast.error(message);
      }
    }

    loadStore();
  }, [user, tenantSlug]);

  useEffect(() => {
    if (!user || !tenantSlug) return
    async function loadDomain() {
      try {
        const data = await apiWithTenant<{ domain: string | null; verified: boolean; token: string | null }>('/store/domain/status', tenantSlug)
        setCustomDomain(data.domain || '')
        setDomainVerified(data.verified || false)
        setDomainToken(data.token || null)
      } catch { }
    }
    loadDomain()
  }, [user, tenantSlug])

  const handleDomainSave = async () => {
    if (!tenantSlug) return
    setDomainSaving(true)
    try {
      const data = await apiWithTenant<{ domain: string; token: string; instructions: string }>('/store/domain/verify', tenantSlug, {
        method: 'POST', body: JSON.stringify({ domain: customDomain }),
      })
      if (data.domain) {
        setCustomDomain(data.domain)
        setDomainToken(data.token)
        setDomainVerified(false)
        setDomainInstructions(data.instructions)
        toast.success('Domínio configurado! Configure o DNS e clique em Verificar.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao configurar domínio')
    } finally { setDomainSaving(false) }
  }

  const handleDomainCheck = async () => {
    if (!tenantSlug) return
    setDomainChecking(true)
    try {
      const data = await apiWithTenant<{ verified: boolean; message: string }>('/store/domain/check', tenantSlug, { method: 'POST' })
      setDomainVerified(data.verified)
      toast.success(data.message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao verificar')
    } finally { setDomainChecking(false) }
  }

  const handleDomainRemove = async () => {
    if (!tenantSlug || !confirm('Remover o domínio personalizado?')) return
    try {
      await apiWithTenant('/store/domain', tenantSlug, { method: 'DELETE' })
      setCustomDomain('')
      setDomainVerified(false)
      setDomainToken(null)
      setDomainInstructions('')
      toast.success('Domínio removido')
    } catch { toast.error('Erro ao remover') }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !tenantSlug) return;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const openingHours = timeRegex.test(storeData.openingHours) ? storeData.openingHours : '00:00';
    const closingHours = timeRegex.test(storeData.closingHours) ? storeData.closingHours : '23:59';

    try {
      await apiWithTenant('/store', tenantSlug, {
        method: 'PUT',
        body: JSON.stringify({
          name: storeData.name,
          description: storeData.description,
          address: storeData.address,
          phone: storeData.phone,
          deliveryFee: parseFloat(storeData.deliveryFee) || 0,
          minOrder: parseFloat(storeData.minOrder) || 0,
          openingHours,
          closingHours,
          logoUrl: logo && !logo.startsWith('blob:') ? logo : null,
          bannerUrl: banner && !banner.startsWith('blob:') ? banner : null,
        }),
      });

      toast.success('Configurações da loja salvas com sucesso!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar loja';
      toast.error(message);
    }
  };

  const [uploadingImage, setUploadingImage] = useState<'logo' | 'banner' | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !tenantSlug) return;

    setUploadingImage(type);
    try {
      const url = await uploadImage(file, tenantSlug);
      if (type === 'logo') setLogo(url);
      else setBanner(url);
      toast.success(type === 'logo' ? 'Logo enviada!' : 'Capa enviada!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar imagem';
      toast.error(message);
    } finally {
      setUploadingImage(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upsell Banner (Básico) */}
      {user?.plan === 'basico' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-[#18181B] border border-orange-200 dark:border-orange-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Use seu próprio domínio</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                No plano Completo você pode configurar um domínio personalizado como www.seulanche.com.br para o seu cardápio.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/upgrade')}
            className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            Fazer Upgrade <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Minha Loja</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie as informações e a aparência da sua loja.</p>
        </div>
        <a
          href={`/loja/${user?.tenantSlug || generateSlug(user?.name || storeData.name)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-lg transition-colors"
        >
          <Eye className="w-4 h-4" /> Visualizar Loja
        </a>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-[#18181B] border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Link público da sua loja</h3>
            <a
              href={`/loja/${user?.tenantSlug || generateSlug(user?.name || storeData.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate inline-flex items-center gap-1 max-w-full"
            >
              {window.location.origin}/loja/{user?.tenantSlug || generateSlug(user?.name || storeData.name)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          </div>

          {/* Custom Domain */}
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Domínio Personalizado</h2>
              {domainVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Verificado
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">https://</span>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="meu-restaurante.com.br"
                disabled={domainVerified}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50"
              />
            </div>

            {domainInstructions && !domainVerified && (
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 whitespace-pre-line">
                {domainInstructions}
              </div>
            )}

            {domainVerified && domainToken && (
              <div className="flex items-center gap-2">
                <input type="text" readOnly value={`https://${customDomain}`} className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white" />
                <button onClick={() => window.open(`https://${customDomain}`, '_blank')} className="p-2 text-orange-600 hover:text-orange-500">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              {!domainVerified ? (
                <>
                  <button
                    type="button"
                    onClick={handleDomainSave}
                    disabled={domainSaving || !customDomain}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-lg shadow-orange-900/20"
                  >
                    {domainSaving ? 'Configurando...' : 'Configurar'}
                  </button>
                  {domainToken && (
                    <button
                      type="button"
                      onClick={handleDomainCheck}
                      disabled={domainChecking}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {domainChecking ? 'Verificando...' : 'Verificar DNS'}
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleDomainRemove}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remover Domínio
                </button>
              )}
            </div>
          </div>
        </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Banner e Logo */}
        <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] overflow-hidden">
          <div className="relative h-48 bg-slate-100 dark:bg-[#09090b] flex items-center justify-center group">
            {banner ? (
              <img src={banner} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-400 flex flex-col items-center">
                <Camera className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm font-medium">Adicionar Capa</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <label className={`cursor-pointer bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2 text-sm font-medium ${uploadingImage === 'banner' ? 'opacity-75' : ''}`}>
                {uploadingImage === 'banner' ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Alterar Capa
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} disabled={uploadingImage === 'banner'} />
              </label>
            </div>
          </div>

          <div className="px-6 pb-6 relative">
            <div className="absolute -top-12 left-6 group">
              <div className="w-24 h-24 rounded-full border-4 border-white dark:border-[#121214] bg-slate-100 dark:bg-[#09090b] flex items-center justify-center overflow-hidden relative">
                {logo ? (
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-8 h-8 text-slate-400" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label className={`cursor-pointer text-white flex items-center justify-center w-full h-full ${uploadingImage === 'logo' ? 'opacity-75' : ''}`}>
                    {uploadingImage === 'logo' ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo')} disabled={uploadingImage === 'logo'} />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Loja</label>
                <input
                  type="text"
                  value={storeData.name}
                  onChange={(e) => setStoreData({ ...storeData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={storeData.phone}
                    onChange={(e) => setStoreData({ ...storeData, phone: formatPhone(e.target.value) })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={storeData.description}
                  onChange={(e) => setStoreData({ ...storeData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Localização e Horários */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Localização e Entrega</h2>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço Completo</label>
              <input
                type="text"
                value={storeData.address}
                onChange={(e) => setStoreData({ ...storeData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Taxa de Entrega</label>
                <CurrencyInput
                  value={parseFloat(storeData.deliveryFee) || 0}
                  onChange={(value) => setStoreData({ ...storeData, deliveryFee: value.toFixed(2) })}
                  placeholder="0,00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pedido Mínimo</label>
                <CurrencyInput
                  value={parseFloat(storeData.minOrder) || 0}
                  onChange={(value) => setStoreData({ ...storeData, minOrder: value.toFixed(2) })}
                  placeholder="0,00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Horário de Funcionamento</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Abertura</label>
                <input
                  type="time"
                  value={storeData.openingHours}
                  onChange={(e) => setStoreData({ ...storeData, openingHours: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fechamento</label>
                <input
                  type="time"
                  value={storeData.closingHours}
                  onChange={(e) => setStoreData({ ...storeData, closingHours: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-[#18181b] transition-colors">
                <input type="checkbox" className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" defaultChecked />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Loja aberta agora (Aceitando pedidos)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}
