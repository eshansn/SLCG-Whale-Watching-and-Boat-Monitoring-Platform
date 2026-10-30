import { Check, Circle } from 'lucide-react';
import { passwordRequirements } from './passwordPolicy';

export default function AuthPasswordGuidance({ password, id }: { password: string; id: string }) {
  const requirements = passwordRequirements(password);
  const score = requirements.filter(requirement => requirement.met).length;
  const strength = score === 6 ? 'Strong' : score >= 4 ? 'Fair' : 'Weak';
  return <div id={id} className="ocean-auth-password-guidance">
    {password && <div className="ocean-auth-strength" role="meter" aria-label="Password requirements met" aria-valuemin={0} aria-valuemax={6} aria-valuenow={score} aria-valuetext={strength}>
      {[2, 4, 6].map(level => <span key={level} className={score >= level ? 'is-filled' : ''} aria-hidden="true" />)}<small>{strength}</small>
    </div>}
    <ul className="ocean-auth-requirements" aria-label="Password requirements">{requirements.map(requirement => <li key={requirement.label} className={requirement.met ? 'is-met' : ''}>
      {requirement.met ? <Check size={12} aria-label="Met" /> : <Circle size={9} aria-label="Required" />}{requirement.label}
    </li>)}</ul>
  </div>;
}
