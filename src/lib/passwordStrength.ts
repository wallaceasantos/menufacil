export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
}

const COMMON = [
  'password',
  'senha',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'admin',
  'menufacil',
  '123456789',
  'letmein',
  'iloveyou',
  '111111',
  '000000',
]

export function scorePassword(password: string): PasswordStrength {
  const pw = password || ''

  if (!pw) return { score: 0, label: '' }
  if (pw.length < 8) return { score: 0, label: 'Muito fraca' }

  let points = 1
  if (pw.length >= 12) points += 1
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points += 1
  if (/\d/.test(pw)) points += 1
  if (/[^A-Za-z0-9]/.test(pw)) points += 1

  if (COMMON.some((c) => pw.toLowerCase().includes(c))) {
    return { score: 1, label: 'Fraca' }
  }

  const score = Math.min(4, points) as PasswordStrength['score']
  const labels = ['', 'Fraca', 'Razoável', 'Forte', 'Muito forte']

  return { score, label: labels[score] }
}