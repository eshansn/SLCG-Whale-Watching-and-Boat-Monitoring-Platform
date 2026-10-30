import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
}

export default function RecoveryOtpInput({ value, onChange, disabled, invalid }: Props) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index]?.trim() ?? '');

  function insert(index: number, text: string) {
    const incoming = text.replace(/[^0-9]/g, '').slice(0, 6);
    if (!incoming) return;
    const start = incoming.length === 6 ? 0 : index;
    const next = [...digits];
    for (let offset = 0; offset < incoming.length && start + offset < 6; offset++) next[start + offset] = incoming[offset];
    onChange(next.map(digit => digit || ' ').join('').trimEnd());
    inputs.current[Math.min(start + incoming.length, 5)]?.focus();
  }

  function paste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    event.preventDefault();
    insert(index, event.clipboardData.getData('text'));
  }

  function navigate(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const target = digits[index] ? index : Math.max(0, index - 1);
      const next = [...digits]; next[target] = '';
      onChange(next.map(digit => digit || ' ').join('').trimEnd());
      inputs.current[target]?.focus();
    } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? 5 : Math.max(0, Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1)));
      inputs.current[target]?.focus();
    }
  }

  return <fieldset className={`ocean-auth-otp ${invalid ? 'is-invalid' : ''}`} disabled={disabled} aria-describedby="recovery-code-help recovery-error">
    <legend className="recovery-label">Verification code</legend>
    <div className="ocean-auth-otp-digits">
      {digits.map((digit, index) => <input key={index} ref={element => { inputs.current[index] = element; }}
        id={`recovery-code-${index}`} name={`code-${index + 1}`} aria-label={`Digit ${index + 1} of 6`}
        aria-invalid={invalid || undefined} type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'}
        maxLength={6} value={digit} className={`ocean-auth-otp-digit ${digit ? 'has-digit' : ''}`}
        onFocus={event => event.target.select()} onPaste={event => paste(event, index)} onKeyDown={event => navigate(event, index)}
        onChange={event => {
          if (event.target.value === '') {
            const next = [...digits]; next[index] = ''; onChange(next.map(item => item || ' ').join('').trimEnd());
          } else insert(index, event.target.value);
        }} />)}
    </div>
  </fieldset>;
}
