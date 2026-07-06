export function formatCentered(text: string, width: number = 48): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(pad) + text
}

export function formatDivider(char: string = '-', width: number = 48): string {
  return char.repeat(width)
}

export function formatLine(left: string, right: string, width: number = 48): string {
  const avail = width - left.length - right.length
  if (avail <= 0) return `${left} ${right}`
  return `${left}${' '.repeat(avail)}${right}`
}

export interface PrintOrderData {
  orderId: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  paymentMethod: string
  status: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    notes?: string | null
    components?: Array<{ name: string; quantity: number; unitPrice: number }>
    choices?: Array<{ groupName: string; optionName: string; quantity: number }>
  }>
  total: number
  createdAt: string
  footerMessage?: string | null
  printType: 'new_order' | 'status_update' | 'kitchen' | 'delivery'
}

export function formatOrderReceipt(data: PrintOrderData, charWidth: number = 48): string {
  const lines: string[] = []

  lines.push('')
  lines.push(formatCentered('MENU FACIL', charWidth))
  lines.push(formatCentered('Pedido - Cupom', charWidth))
  lines.push(formatDivider('=', charWidth))

  lines.push(formatLine(`Pedido: #${data.orderId.slice(0, 8)}`, data.createdAt.split('T')[0], charWidth))
  lines.push(formatLine('Cliente:', data.customerName, charWidth))

  if (data.deliveryAddress && data.deliveryAddress !== 'Retirada no Local') {
    lines.push(formatLine('Endereco:', data.deliveryAddress, charWidth))
  } else {
    lines.push(formatLine('Tipo:', 'RETIRADA NO LOCAL', charWidth))
  }

  lines.push(formatLine('Telefone:', data.customerPhone, charWidth))

  if (data.paymentMethod) {
    lines.push(formatLine('Pagamento:', data.paymentMethod, charWidth))
  }

  lines.push(formatDivider('-', charWidth))

  lines.push(formatLine('QTD  ITEM', 'VALOR', charWidth))
  lines.push(formatDivider('-', charWidth))

  for (const item of data.items) {
    const name = `${item.quantity}x ${item.name}`
    const price = `R$ ${(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')}`
    lines.push(formatLine(name, price, charWidth))

    if (item.notes) {
      lines.push(`    Obs: ${item.notes}`)
    }

    if (item.components && item.components.length > 0) {
      for (const c of item.components) {
        if (c.unitPrice > 0) {
          lines.push(`    + ${c.quantity}x ${c.name} R$${c.unitPrice.toFixed(2).replace('.', ',')}`)
        } else {
          lines.push(`    + ${c.quantity}x ${c.name}`)
        }
      }
    }

    if (item.choices && item.choices.length > 0) {
      for (const ch of item.choices) {
        lines.push(`    > ${ch.groupName}: ${ch.quantity}x ${ch.optionName}`)
      }
    }
  }

  lines.push(formatDivider('-', charWidth))
  lines.push(formatLine('TOTAL:', `R$ ${data.total.toFixed(2).replace('.', ',')}`, charWidth))
  lines.push(formatDivider('=', charWidth))

  if (data.printType === 'kitchen') {
    lines.push(formatCentered('*** COZINHA ***', charWidth))
  } else if (data.printType === 'delivery') {
    lines.push(formatCentered('*** ENTREGA ***', charWidth))
  }

  if (data.footerMessage) {
    lines.push('')
    lines.push(formatCentered(data.footerMessage, charWidth))
  }

  lines.push('')
  lines.push(formatCentered(`Gerado: ${new Date().toLocaleString('pt-BR')}`, charWidth))
  lines.push('')
  lines.push('\n\n\n'.repeat(3))

  return lines.join('\n')
}

export function formatStatusReceipt(data: PrintOrderData, charWidth: number = 48): string {
  const lines: string[] = []

  lines.push('')
  lines.push(formatCentered('MENU FACIL', charWidth))
  lines.push(formatCentered('Atualizacao de Status', charWidth))
  lines.push(formatDivider('=', charWidth))

  const statusLabels: Record<string, string> = {
    pending: 'PENDENTE',
    preparing: 'PREPARANDO',
    completed: 'CONCLUIDO',
    cancelled: 'CANCELADO',
  }

  lines.push(formatLine(`Pedido: #${data.orderId.slice(0, 8)}`, '', charWidth))
  lines.push(formatLine('Cliente:', data.customerName, charWidth))
  lines.push(formatLine('Novo Status:', statusLabels[data.status] || data.status, charWidth))
  lines.push(formatDivider('=', charWidth))
  lines.push('')
  lines.push('\n\n\n'.repeat(3))

  return lines.join('\n')
}
