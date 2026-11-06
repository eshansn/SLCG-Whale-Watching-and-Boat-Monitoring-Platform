import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, LifeBuoy, LoaderCircle, Send } from 'lucide-react';
import OceanScene from '../components/auth/OceanScene';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api/httpClient';
import type { AuthSession } from '../auth/types';
import { supportFaqs } from './supportFaqs';
import { supportPortals, supportReturn } from './supportNavigation';
import '../components/auth/ocean-auth.css';
import './support.css';

const issueCategories = ['Login & Account Issues', 'Trip & Booking Issues', 'Passenger Registration', 'GPS & Tracking Issues', 'Technical Problems', 'Other'];

function Faq({ question, answer, id }: { question: string; answer: string; id: string }) {
  const [open, setOpen] = useState(false);
  return <div className="border-b border-[#8ca9b92e]">
    <h3><button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={id}
      className="flex min-h-14 w-full items-center justify-between gap-5 py-4 text-left text-sm font-medium text-[#eafbff]">
      {question}<ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
    </button></h3>
    <div id={id} aria-hidden={!open} className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="min-h-0 overflow-hidden"><p className="pb-5 text-sm leading-7 text-[#a8c1cf]">{answer}</p></div>
    </div>
  </div>;
}

type Fields = { fullName: string; email: string; portal: string; subject: string; category: string; message: string; website: string };

function SupportForm({ session, portal, subject, category }: { session: AuthSession | null; portal: string; subject: string; category: string }) {
  const initial: Fields = { fullName: '', email: session?.email ?? '', portal, subject, category, message: '', website: '' };
  const [fields, setFields] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState(''), [reference, setReference] = useState('');
  const submitting = useRef(false), activeRequest = useRef<AbortController | null>(null);
  const attempt = useRef<{ body: string; id: string } | null>(null);
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const update = (name: keyof Fields, value: string) => setFields(previous => ({ ...previous, [name]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const next: Partial<Record<keyof Fields, string>> = {};
    for (const name of ['fullName', 'email', 'portal', 'subject', 'category', 'message'] as const)
      if (!fields[name].trim()) next[name] = 'This field is required.';
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) next.email = 'Enter a valid email address.';
    setErrors(next); setFailure(''); setReference('');
    if (Object.keys(next).length) {
      (event.currentTarget.elements.namedItem(Object.keys(next)[0]) as HTMLElement | null)?.focus(); return;
    }
    const body = JSON.stringify(Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, value.trim()])));
    if (!attempt.current || attempt.current.body !== body) attempt.current = { body, id: crypto.randomUUID() };
    const submissionId = attempt.current.id;
    const controller = new AbortController(); activeRequest.current = controller;
    submitting.current = true; setBusy(true);
    try {
      const response = await apiFetch('/api/support/requests', { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}) },
        body: JSON.stringify({ ...JSON.parse(body), submissionId }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]) });
      const payload = await response.json().catch(() => null) as { requestId?: string; message?: string } | null;
      if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Please wait before trying again.' :
        response.status === 400 ? 'Please check the required fields and try again.' :
          response.status === 409 ? 'This reference is already in use. Edit the request before submitting again.' :
            'Your request could not be confirmed. Please try again; your message has been kept.');
      if (payload?.requestId !== submissionId) throw new Error('Your request could not be confirmed. Please try again.');
      setReference(payload.requestId); setFields({ ...initial, subject: '', message: '', website: '' }); attempt.current = null;
    } catch (error) {
      if (!controller.signal.aborted) setFailure(error instanceof Error && error.name !== 'TypeError' && error.name !== 'TimeoutError' ? error.message :
        'Unable to confirm your request. Check your connection and retry; your message has been kept.');
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) { setBusy(false); requestAnimationFrame(() => result.current?.focus()); }
    }
  };
  const field = (name: keyof Fields) => ({ id: `support-${name}`, name, value: fields[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => update(name, event.target.value),
    'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `support-${name}-error` : undefined, disabled: busy });
  const error = (name: keyof Fields) => errors[name] && <p id={`support-${name}-error`} className="mt-2 text-xs text-[#ffd2cc]">{errors[name]}</p>;
  return <form onSubmit={submit} noValidate aria-busy={busy} className="mt-8">
    <p className="mb-6 text-xs text-[#a8c1cf]">Fields marked * are required. Do not include passwords, verification codes or sensitive passenger details.</p>
    <div className="grid gap-6 sm:grid-cols-2">
      <div><label htmlFor="support-fullName">Full Name *</label><input {...field('fullName')} required autoComplete="name" maxLength={160} />{error('fullName')}</div>
      <div><label htmlFor="support-email">Email Address *</label><input {...field('email')} required type="email" autoComplete="email" maxLength={256} />{error('email')}</div>
      <div><label htmlFor="support-portal">Portal / User Type *</label><select {...field('portal')} required>
        <option value="NotSure">Not sure / Public visitor</option>{supportPortals.map(p => <option key={p.role} value={p.role}>{p.label}</option>)}
      </select>{error('portal')}</div>
      <div><label htmlFor="support-category">Issue Category *</label><select {...field('category')} required>
        <option value="">Select an issue category</option>{issueCategories.map(value => <option key={value}>{value}</option>)}
      </select>{error('category')}</div>
      <div className="sm:col-span-2"><label htmlFor="support-subject">Subject *</label><input {...field('subject')} required maxLength={160} />{error('subject')}</div>
      <div className="sm:col-span-2"><label htmlFor="support-message">Message / Description *</label><textarea {...field('message')} required rows={6} maxLength={4000} />{error('message')}</div>
    </div>
    <div className="support-honeypot" aria-hidden="true"><label htmlFor="support-website">Website</label><input {...field('website')} tabIndex={-1} autoComplete="off" /></div>
    <div ref={result} tabIndex={-1} className="mt-6 outline-none">
      {failure && <p role="alert" className="text-sm leading-6 text-[#ffd2cc]">{failure}</p>}
      {reference && <div role="status" className="text-sm leading-7 text-[#8af5ff]"><p>Your support request has been received.</p><p className="break-all">Reference: <strong>{reference}</strong></p><p className="text-xs text-[#a8c1cf]">Keep this reference for follow-up.</p></div>}
    </div>
    <button type="submit" disabled={busy} className="ocean-auth-primary mt-6 sm:!w-auto sm:px-7">
      {busy ? <LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Send size={16} aria-hidden="true" />}{busy ? 'Sending…' : 'Send support request'}
    </button>
  </form>;
}

export default function SupportCenter() {
  const { session, status } = useAuth();
  const [query] = useSearchParams();
  const back = supportReturn(query.get('from'), session);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const title = document.title; document.title = 'Support Center | WWMS'; window.scrollTo(0, 0); heading.current?.focus({ preventScroll: true });
    return () => { document.title = title; };
  }, []);
  return <div className="ocean-auth-shell support-center">
    <OceanScene />
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-7 sm:px-10">
      <Link to="/" className="ocean-auth-brand-link" aria-label="WWMS home"><img src="/SLCGicon.png" alt="Sri Lanka Coast Guard" className="ocean-auth-brand-crest" /><strong className="tracking-widest">WWMS</strong><span className="text-xs text-[#a8c1cf]">Support Center</span></Link>
      <Link to={back.to} className="ocean-auth-link"><ArrowLeft size={15} aria-hidden="true" />{back.portal ? `Back to ${back.portal.label}` : 'Back to home'}</Link>
    </header>
    <main className="mx-auto max-w-5xl px-6 pb-16 pt-8 sm:px-10 sm:pt-14">
      <LifeBuoy size={30} aria-hidden="true" className="mb-6 text-[#8af5ff]" />
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-medium tracking-tight text-[#eafbff] outline-none sm:text-5xl">How Can We Help You?</h1>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-[#a8c1cf] sm:text-base">Find answers to common questions about using the Whale-Watching and Boat Monitoring System. If you need further assistance, contact our support team using the form below.</p>
      <a href="#contact-support" className="ocean-auth-link mt-5 !text-[#8af5ff]">Still need assistance? Contact support</a>
      <section aria-label="Frequently asked questions" className="mt-10 space-y-10">
        {supportFaqs.map((group, groupIndex) => <section key={group.category} aria-labelledby={`support-category-${groupIndex}`}>
          <h2 id={`support-category-${groupIndex}`} className="mb-3 text-lg font-semibold text-[#8af5ff]">{group.category}</h2>
          {group.items.map(([question, answer], index) => <Faq key={question} question={question} answer={answer} id={`support-faq-${groupIndex}-${index}`} />)}
        </section>)}
      </section>
      <section id="contact-support" aria-labelledby="contact-support-title" className="mt-16 scroll-mt-8 border-t border-[#8ca9b92e] pt-10">
        <h2 id="contact-support-title" className="text-2xl font-medium text-[#eafbff] sm:text-3xl">Still Need Assistance?</h2>
        <p className="mt-4 text-sm leading-7 text-[#a8c1cf]">Couldn’t find the answer you were looking for? Send our support team a message and we’ll assist you.</p>
        {status === 'loading' ? <p className="mt-6 text-sm text-[#a8c1cf]" role="status">Loading your details…</p> : <SupportForm key={session?.userId ?? 'guest'} session={session} portal={back.portal?.role ?? 'NotSure'} subject={(query.get('subject') ?? '').slice(0, 160)} category={issueCategories.includes(query.get('category') ?? '') ? query.get('category')! : ''} />}
      </section>
    </main>
    <footer className="mx-auto max-w-6xl px-6 pb-7 text-xs text-[#8ca9b9] sm:px-10">Sri Lanka Coast Guard · WWMS Support Center</footer>
  </div>;
}
