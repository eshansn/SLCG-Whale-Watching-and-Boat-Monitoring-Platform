import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export default function AuthField({ id, label, icon: FieldIcon, hint, error, containerClassName = '', type = 'text', ...input }: Props) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  const describedBy = [input['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className={`ocean-auth-field ${containerClassName}`}>
    <label htmlFor={id} className="ocean-auth-label">{label}</label>
    <div className={`ocean-auth-input-wrap ${password ? '' : 'without-action'}`}>
      <FieldIcon size={16} className="ocean-auth-input-icon" aria-hidden="true" />
      <input {...input} id={id} type={password && visible ? 'text' : type} className="ocean-auth-input"
        aria-describedby={describedBy} aria-invalid={error ? true : input['aria-invalid']} />
      {password && <button type="button" className="ocean-auth-visibility" disabled={input.disabled}
        aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(current => !current)}>
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>}
    </div>
    {hint && <p id={`${id}-hint`} className="ocean-auth-field-hint">{hint}</p>}
    {error && <p id={`${id}-error`} className="ocean-auth-field-error">{error}</p>}
  </div>;
}
