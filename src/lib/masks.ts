/**
 * Máscaras para campos de formulário brasileiros.
 * Cada função aplica a máscara progressivamente conforme o usuário digita.
 */

/**
 * Aplica máscara de CEP: 00000-000
 */
export function maskCep(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
}

/**
 * Aplica máscara de telefone brasileiro: (99) 99999-9999 ou (99) 9999-9999
 */
export function maskPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  if (cleaned.length <= 2) return cleaned.length ? `(${cleaned}` : '';
  if (cleaned.length <= 7) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  }
  // Celular: 11 dígitos (9º dígito), Fixo: 10 dígitos
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

/**
 * Remove tudo que não for dígito.
 */
export function sanitizeNumeric(value: string): string {
  return value.replace(/\D/g, '');
}
