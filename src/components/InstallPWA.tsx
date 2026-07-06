import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Download, X, Share2, PlusSquare } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

export function InstallPWA() {
  const { canInstall, isInstalled, isIOS, install } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)

  if (isInstalled || dismissed || !canInstall) return null

  const handleInstall = async () => {
    if (isIOS) {
      setDismissed(true)
      return
    }
    const installed = await install()
    if (installed) setDismissed(true)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -60 }}
        className="fixed top-0 left-0 right-0 z-[200] bg-white dark:bg-[#121214] border-b border-slate-200 dark:border-[#262626] shadow-lg"
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {isIOS ? 'Instale na tela inicial' : 'Instalar App'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isIOS
                ? 'Toque em Compartilhar > "Adicionar à Tela de Início"'
                : 'Acesse seus pedidos como um app nativo'}
            </p>
          </div>
          {isIOS ? (
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-slate-500">Depois</span>
              <PlusSquare className="w-5 h-5 text-blue-500" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleInstall}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-bold transition-colors">
                Instalar
              </button>
              <button onClick={() => setDismissed(true)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
