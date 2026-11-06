import { useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '../../api/httpClient';

export default function Contact() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ message: string; error: boolean }>();
  const sending = useRef(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    sending.current = true;
    setSubmitting(true);
    setResult(undefined);
    try {
      const response = await apiFetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fields.get('name'), email: fields.get('email'), message: fields.get('message') }),
        signal: AbortSignal.timeout(35_000) });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(response.status === 429 ? 'Too many inquiries. Please wait a minute before trying again.' :
        payload?.message || 'Your inquiry could not be sent. Please try again later.');
      setResult({ message: payload?.message || 'Your inquiry has been sent.', error: false });
      form.reset();
    } catch (error) {
      setResult({ message: error instanceof Error && error.name !== 'TimeoutError' ? error.message :
        'The request timed out. Please check before resending your inquiry.', error: true });
    } finally { sending.current = false; setSubmitting(false); }
  };
  return (
    <section 
      id="contact"
      className="public-contact w-full min-h-screen py-10 px-4 flex items-center justify-center"
      style={{ 
        fontFamily: "'Montserrat', sans-serif" 
      }}
    >
      {/* Content Container */}
      <div className="public-contact-card w-full max-w-4xl p-[25px] md:p-[41px] relative">

        {/* Content */}
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10 relative z-10">
          
          {/* Logo */}
          <div className="w-full md:w-1/3 flex justify-center">
            <img 
              src="/SLCGicon.png" 
              alt="Sri Lanka Coast Guard" 
              className="w-36 h-36 md:w-48 md:h-48 object-contain"
            />
          </div>

          {/* Form */}
          <div className="w-full md:w-2/3">
            <h2 className="text-[#0B213E] text-2xl md:text-3xl font-bold mb-6">
              Have questions?<br />
              Let's connect.
            </h2>
            
            <form className="space-y-3" onSubmit={event => void submit(event)} aria-busy={submitting}>
              <input name="name" type="text" required maxLength={160} aria-label="Your name" placeholder="Enter Your Name" className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B213E] outline-none transition-all" />
              <input name="email" type="email" required maxLength={256} aria-label="Your email address" placeholder="Enter Your Email Address" className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B213E] outline-none transition-all" />
              <textarea name="message" required maxLength={2000} aria-label="Your inquiry or feedback" placeholder="Type Your Inquiry Or Feedback..." rows={3} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B213E] outline-none transition-all"></textarea>
              <button type="submit" disabled={submitting} className="bg-[#0B213E] text-white px-10 py-3 rounded-xl font-bold hover:bg-[#1a3a63] transition-colors">
                {submitting ? 'Sending…' : 'Submit'}
              </button>
              {result && <p role={result.error ? 'alert' : 'status'} className="text-sm text-[#0B213E]">{result.message}</p>}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
