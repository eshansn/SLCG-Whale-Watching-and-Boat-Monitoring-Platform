import type { ButtonHTMLAttributes } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean;
  pendingLabel?: string;
}

export default function AuthButton({ children, pending = false, pendingLabel = 'Please wait…', disabled, type = 'submit', ...props }: Props) {
  return <button {...props} type={type} className="ocean-auth-primary" disabled={disabled || pending}>
    {pending ? <><LoaderCircle size={15} className="ocean-auth-spin" aria-hidden="true" />{pendingLabel}</> : <>{children}<ArrowRight size={15} aria-hidden="true" /></>}
  </button>;
}
