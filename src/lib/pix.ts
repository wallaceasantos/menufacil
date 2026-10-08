/**
 * Gera um código PIX Copia e Cola estático com valor variável.
 * Utiliza o padrão EMVCo + CRC16-CCITT-FALSE.
 */
export function generateStaticPixCode(amount: number): string {
  const merchantAccountInfo =
    '0014br.gov.bcb.pix' +
    '0136123e4567-e89b-12d3-a456-426614174000';

  const merchantAccountInfoField =
    '26' + String(merchantAccountInfo.length).padStart(2, '0') + merchantAccountInfo;

  const amountValue = amount.toFixed(2);

  const payload =
    '000201' + // Payload Format Indicator
    merchantAccountInfoField +
    '52040000' + // Merchant Category Code
    '5303986' + // Transaction Currency (BRL)
    '54' + String(amountValue.length).padStart(2, '0') + amountValue +
    '5802BR' + // Country Code
    '5914MenuFacil Ltda' +
    '6009Sao Paulo' +
    '62070503***'; // Additional Data Field Template (TXID ***)

  const crc = calculateCrc16(payload);
  return payload + '6304' + crc;
}

function calculateCrc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
