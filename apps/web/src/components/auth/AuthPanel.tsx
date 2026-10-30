import { useEffect, type ReactNode } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
  titleId: string;
  label: string;
  step?: number;
  complete?: boolean;
  note?: string;
}

export default function AuthPanel({ children, titleId, label, step, complete, note = 'Sri Lanka Coast Guard · Secure account access' }: Props) {
  useEffect(() => { document.getElementById(titleId)?.focus({ preventScroll: true }); }, [titleId]);
  return <section className="ocean-auth-panel" aria-labelledby={titleId}>
    <div className="ocean-auth-panel-top">
      <span className="ocean-auth-security-label"><ShieldCheck size={14} aria-hidden="true" />{label}</span>
      {step !== undefined && <div className="ocean-auth-steps" aria-label={complete ? 'Complete' : `Step ${step} of 3`}>
        {[1, 2, 3].map(item => <span key={item} className={complete || item < step ? 'is-done' : item === step ? 'is-current' : ''} />)}
      </div>}
    </div>
    {children}
    <p className="ocean-auth-panel-note"><KeyRound size={11} aria-hidden="true" />{note}</p>
  </section>;
}
