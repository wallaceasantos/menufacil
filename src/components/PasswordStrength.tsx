import { scorePassword } from '../lib/passwordStrength'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e']
const TEXT_COLORS = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-emerald-500']

export function PasswordStrength({ password }: { password: string }) {
  const { score, label } = scorePassword(password)

  if (!password) return null

  const textColor = score === 0 ? 'text-red-500' : TEXT_COLORS[Math.max(0, score - 1)]

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              score > i ? '' : 'bg-slate-200 dark:bg-[#262626]'
            }`}
            style={score > i ? { backgroundColor: COLORS[Math.min(score - 1, 3)] } : undefined}
          />
        ))}
      </div>
      <p className={`text-xs mt-1.5 font-medium ${textColor}`}>{label}</p>
    </div>
  )
}