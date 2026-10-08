import { Utensils } from 'lucide-react';

export function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0B] flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.3)] animate-pulse">
          <Utensils className="w-8 h-8 text-white" />
        </div>
        <div className="absolute inset-0 rounded-2xl border-2 border-orange-500/30 animate-ping" />
      </div>
      <p className="mt-6 text-slate-500 dark:text-slate-400 font-medium animate-pulse">
        Carregando MenuFácil...
      </p>
    </div>
  );
}
