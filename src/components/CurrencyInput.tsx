import { useState, useEffect, useCallback } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Converte centavos (ex: 1290) para string formatada "12,90"
 */
function formatCurrency(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  return `${reais},${centavos.toString().padStart(2, '0')}`;
}

/**
 * Extrai o valor em centavos de uma string digitada pelo usuário.
 * Aceita padrões como: "12,90", "12.90", "1290", "R$ 12,90"
 */
function parseCurrencyString(input: string): number {
  // Remove "R$", espaços e pontos de milhar
  let cleaned = input.replace(/[R$\s.]/g, '');
  // Substitui vírgula decimal por nada (vamos tratar como centavos)
  cleaned = cleaned.replace(',', '');
  // Remove zeros à esquerda, mas mantém pelo menos um dígito
  cleaned = cleaned.replace(/^0+/, '') || '0';
  return parseInt(cleaned, 10) || 0;
}

export function CurrencyInput({
  value,
  onChange,
  className = '',
  placeholder = '0,00',
  required = false,
  disabled = false,
}: CurrencyInputProps) {
  // value vem como número decimal (ex: 12.9), convertemos para centavos
  const centsFromValue = Math.round(value * 100);
  const [displayValue, setDisplayValue] = useState(formatCurrency(centsFromValue));
  const [isFocused, setIsFocused] = useState(false);

  // Sincroniza quando o value externo muda (ex: ao editar item existente)
  useEffect(() => {
    if (!isFocused) {
      const cents = Math.round(value * 100);
      setDisplayValue(formatCurrency(cents));
    }
  }, [value, isFocused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Permite campo vazio
      if (raw === '' || raw === 'R$ ') {
        setDisplayValue('');
        onChange(0);
        return;
      }

      const cents = parseCurrencyString(raw);
      setDisplayValue(formatCurrency(cents));
      onChange(cents / 100);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Ao focar, mostra o valor sem "R$ " para facilitar digitação
    if (value === 0) {
      setDisplayValue('');
    } else {
      setDisplayValue(formatCurrency(Math.round(value * 100)));
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Ao sair, formata bonito
    const cents = Math.round(value * 100);
    if (cents === 0) {
      setDisplayValue('0,00');
    } else {
      setDisplayValue(formatCurrency(cents));
    }
  }, [value]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500 pointer-events-none select-none">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        required={required}
        disabled={disabled}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`${className} pl-8`}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}
