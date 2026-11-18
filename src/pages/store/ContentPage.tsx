import React, { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';

export const ContentPage: React.FC<{ slug: string; isBlog?: boolean }> = ({ slug, isBlog = false }) => {
  const { bootstrap, lang, navigate } = useStore();
  const [page, setPage] = useState<any | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isBlog && !slug) return;
    const url = isBlog ? `/api/store/blog/${slug}` : `/api/store/pages/${slug}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPage(d ? (isBlog ? d.post : d.page) : null));
  }, [slug, isBlog]);

  const sendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/store/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactForm),
    });
    if (r.ok) {
      setSent(true);
      setContactForm({ name: '', phone: '', email: '', message: '' });
    }
  };

  if (isBlog && !slug) {
    const posts = bootstrap?.posts || [];
    return (
      <main className="max-w-[1240px] mx-auto px-4 py-8 space-y-6">
        <h1 className="text-3xl font-extrabold text-[var(--ink)]">Shuddho Wellness Journal</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <article
              key={post.id}
              onClick={() => navigate(`/blog/${post.slug}`)}
              className="rounded-[18px] border overflow-hidden cursor-pointer hover:-translate-y-0.5 transition"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
            >
              <img src={post.image} alt={post.title_en} className="w-full h-52 object-cover bg-[var(--image-bg)]" />
              <div className="p-5 space-y-2">
                <div className="text-xs font-semibold text-[var(--primary)]">{post.category} · {post.author}</div>
                <h2 className="text-xl font-bold text-[var(--ink)]">{lang === 'bn' ? post.title_bn : post.title_en}</h2>
                <p className="text-sm text-[var(--muted)]">{lang === 'bn' ? post.excerpt_bn : post.excerpt_en}</p>
              </div>
            </article>
          ))}
        </div>
      </main>
    );
  }

  if (!page) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-48 rounded-[18px] bg-[var(--image-bg)] animate-pulse" />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div
        className="rounded-[18px] border p-6 sm:p-8 space-y-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
          {lang === 'bn' ? page.title_bn : page.title_en}
        </h1>
        {page.image && (
          <img src={page.image} alt={page.title_en} className="w-full h-64 object-cover rounded-[14px] bg-[var(--image-bg)]" />
        )}
        <div className="text-sm sm:text-base text-[var(--ink)] leading-relaxed whitespace-pre-line">
          {lang === 'bn' ? page.content_bn : page.content_en}
        </div>
      </div>

      {slug === 'contact' && (
        <form
          onSubmit={sendContact}
          className="rounded-[18px] border p-6 space-y-4"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <h2 className="text-lg font-bold text-[var(--ink)]">Send Us a Message</h2>
          {sent && <div className="p-3 rounded-xl bg-[var(--bg)] text-[var(--success)] text-sm">Message received! Our team will respond shortly.</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" required placeholder="Your Name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm" />
            <input type="tel" placeholder="Phone Number" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm" />
          </div>
          <input type="email" placeholder="Email Address" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm" />
          <textarea required rows={4} placeholder="How can we help?" value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm" />
          <button type="submit" className="px-6 py-2.5 rounded-[12px] text-sm font-bold text-white" style={{ backgroundColor: 'var(--primary)' }}>
            Send Message
          </button>
        </form>
      )}
    </main>
  );
};
