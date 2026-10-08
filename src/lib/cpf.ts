/**
 * Validação de CPF (Cadastro de Pessoas Físicas) brasileiro.
 * Implementa o algoritmo oficial de dígitos verificadores.
 */

/**
 * Remove caracteres não numéricos do CPF.
 */
export function sanitizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida se o CPF possui o formato correto e dígitos verificadores válidos.
 * Aceita CPF com ou sem máscara (com pontos e hífen).
 *
 * @example
 * isValidCpf('111.444.777-35') // true
 * isValidCpf('11144477735')    // true
 * isValidCpf('123.456.789-00') // false
 */
export function isValidCpf(cpf: string): boolean {
  const cleaned = sanitizeCpf(cpf);

  // CPF deve ter exatamente 11 dígitos
  if (cleaned.length !== 11) return false;

  // Rejeita CPFs com todos os dígitos iguais (000.000.000-00, 111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cleaned[i]) * (10 - i);
  }
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10) firstCheck = 0;

  if (firstCheck !== Number(cleaned[9])) return false;

  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cleaned[i]) * (11 - i);
  }
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10) secondCheck = 0;

  return secondCheck === Number(cleaned[10]);
}

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
export function maskCpf(cpf: string): string {
  const cleaned = sanitizeCpf(cpf).slice(0, 11);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}
