/**
 * Extrai o horário no formato HH:mm a partir de uma string ISO,
 * de um objeto Date ou de um valor já no formato HH:mm.
 */
export function extractTime(value: string | Date | null | undefined): string {
  if (!value) return '00:00';
  const str = typeof value === 'string' ? value : value.toISOString();
  const match = str.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  if (/^\d{2}:\d{2}$/.test(str)) return str;
  return '00:00';
}
