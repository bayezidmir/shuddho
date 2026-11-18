import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, FileText, MessageSquare, Plus } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const AdminContent: React.FC = () => {
  const { bootstrap, refreshBootstrap } = useStore();
  const [tab, setTab] = useState<'homepage' | 'pages' | 'blog' | 'inbox'>('homepage');
  const [sections, setSections] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [contentData, setContentData] = useState<any>({ pages: [], posts: [], contactMessages: [] });
  const [pageForm, setPageForm] = useState({ slug: '', title_en: '', title_bn: '', content_en: '', is_landing: false });
  const [postForm, setPostForm] = useState({ slug: '', title_en: '', excerpt_en: '', content_en: '', category: 'Wellness' });
  const [savedMsg, setSavedMsg] = useState('');

  const loadContent = async () => {
    const r = await fetch('/api/admin/content');
    if (r.ok) setContentData(await r.json());
  };

  useEffect(() => {
    if (bootstrap) {
      setSections(bootstrap.homepageSections || []);
      setAnnouncements(bootstrap.announcements || []);
    }
    loadContent();
  }, [bootstrap]);

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const saveHomepage = async () => {
    await Promise.all([
      fetch('/api/admin/settings/homepage_sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: sections }),
      }),
      fetch('/api/admin/settings/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: announcements }),
      }),
    ]);
    await refreshBootstrap();
    setSavedMsg('Homepage sections & announcement bar updated live on storefront.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const savePage = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageForm),
    });
    if (r.ok) {
      setPageForm({ slug: '', title_en: '', title_bn: '', content_en: '', is_landing: false });
      loadContent();
      refreshBootstrap();
    }
  };

  const savePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postForm),
    });
    if (r.ok) {
      setPostForm({ slug: '', title_en: '', excerpt_en: '', content_en: '', category: 'Wellness' });
      loadContent();
      refreshBootstrap();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1D2327]">Content CMS & Homepage Builder</h1>
        <div className="flex rounded-lg bg-white border border-[#DCDCDE] p-0.5 text-xs">
          {[
            { id: 'homepage', label: 'Homepage Sections' },
            { id: 'pages', label: `Pages (${contentData.pages.length})` },
            { id: 'blog', label: `Blog (${contentData.posts.length})` },
            { id: 'inbox', label: `Contact Inbox (${contentData.contactMessages.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-md font-semibold ${tab === t.id ? 'bg-[#0E5E6F] text-white' : 'text-[#646970]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {savedMsg && <div className="p-3 rounded-xl bg-[#E6F7EF] text-[#1E9E6A] text-xs font-semibold">{savedMsg}</div>}

      {tab === 'homepage' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Announcement Bar Messages</h2>
              <button type="button" onClick={saveHomepage} className="px-4 py-1.5 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold">
                Save Homepage & Announcements
              </button>
            </div>
            {announcements.map((a, idx) => (
              <div key={a.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                <input
                  type="text"
                  value={a.textEn}
                  onChange={(e) => {
                    const next = [...announcements];
                    next[idx] = { ...a, textEn: e.target.value };
                    setAnnouncements(next);
                  }}
                  className="sm:col-span-5 px-2.5 py-1.5 rounded border"
                  placeholder="Announcement (English)"
                />
                <input
                  type="text"
                  value={a.textBn}
                  onChange={(e) => {
                    const next = [...announcements];
                    next[idx] = { ...a, textBn: e.target.value };
                    setAnnouncements(next);
                  }}
                  className="sm:col-span-5 px-2.5 py-1.5 rounded border"
                  placeholder="Announcement (বাংলা)"
                />
                <label className="sm:col-span-2 inline-flex items-center gap-1.5 font-semibold">
                  <input
                    type="checkbox"
                    checked={Boolean(a.active)}
                    onChange={(e) => {
                      const next = [...announcements];
                      next[idx] = { ...a, active: e.target.checked };
                      setAnnouncements(next);
                    }}
                  /> Active
                </label>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#DCDCDE] divide-y">
            {sections.map((s, idx) => (
              <div key={s.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                  <span className="w-6 h-6 rounded-full bg-[#EEF5F5] text-[#0E5E6F] font-bold flex items-center justify-center tabular-nums">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="font-mono text-[11px] uppercase text-[#646970]">{s.type}</div>
                    <input
                      type="text"
                      value={s.titleEn}
                      onChange={(e) => {
                        const next = [...sections];
                        next[idx] = { ...s, titleEn: e.target.value };
                        setSections(next);
                      }}
                      className="w-full max-w-md px-2.5 py-1 rounded border font-semibold"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...sections];
                      next[idx] = { ...s, visible: !s.visible };
                      setSections(next);
                    }}
                    className={`px-2.5 py-1 rounded-lg border font-semibold inline-flex items-center gap-1 ${s.visible ? 'bg-[#E6F7EF] text-[#1E9E6A]' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {s.visible ? <><Eye className="w-3.5 h-3.5" /> Visible</> : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>}
                  </button>
                  <button type="button" onClick={() => moveSection(idx, -1)} className="p-1.5 rounded border hover:bg-[#F6F7F7]" aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 1)} className="p-1.5 rounded border hover:bg-[#F6F7F7]" aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pages' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <form onSubmit={savePage} className="md:col-span-5 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 text-xs">
            <h2 className="font-bold text-sm flex items-center gap-1.5"><Plus className="w-4 h-4 text-[#0E5E6F]" /> Create / Update CMS Page</h2>
            <input type="text" required placeholder="Slug (e.g. lab-test-reports)" value={pageForm.slug} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
            <input type="text" required placeholder="Page Title (English)" value={pageForm.title_en} onChange={(e) => setPageForm({ ...pageForm, title_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            <input type="text" placeholder="Page Title (বাংলা)" value={pageForm.title_bn} onChange={(e) => setPageForm({ ...pageForm, title_bn: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            <textarea rows={5} required placeholder="Page Body Content..." value={pageForm.content_en} onChange={(e) => setPageForm({ ...pageForm, content_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={pageForm.is_landing} onChange={(e) => setPageForm({ ...pageForm, is_landing: e.target.checked })} />
              High-converting Ad Landing Page
            </label>
            <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5E6F] text-white font-bold">Publish Page</button>
          </form>
          <div className="md:col-span-7 bg-white rounded-xl border border-[#DCDCDE] divide-y text-xs">
            {contentData.pages.map((p: any) => (
              <div key={p.id} className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="font-bold flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-[#0E5E6F]" /> {p.title_en}</div>
                  <div className="font-mono text-[11px] text-[#646970]">/pages/{p.slug}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#E6F7EF] text-[#1E9E6A] text-[10px] font-bold uppercase">{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'blog' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <form onSubmit={savePost} className="md:col-span-5 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 text-xs">
            <h2 className="font-bold text-sm">Publish Blog Article</h2>
            <input type="text" required placeholder="Slug (e.g. pure-ghee-benefits)" value={postForm.slug} onChange={(e) => setPostForm({ ...postForm, slug: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
            <input type="text" required placeholder="Article Title" value={postForm.title_en} onChange={(e) => setPostForm({ ...postForm, title_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            <input type="text" placeholder="Short Excerpt" value={postForm.excerpt_en} onChange={(e) => setPostForm({ ...postForm, excerpt_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            <textarea rows={5} required placeholder="Article content..." value={postForm.content_en} onChange={(e) => setPostForm({ ...postForm, content_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5E6F] text-white font-bold">Publish Article</button>
          </form>
          <div className="md:col-span-7 bg-white rounded-xl border border-[#DCDCDE] divide-y text-xs">
            {contentData.posts.map((p: any) => (
              <div key={p.id} className="p-3.5">
                <div className="font-bold">{p.title_en}</div>
                <div className="text-[11px] text-[#646970]">/blog/{p.slug} · {p.category}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'inbox' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] divide-y text-xs">
          {contentData.contactMessages.length === 0 ? (
            <div className="p-8 text-center text-[#646970]">No customer contact messages yet.</div>
          ) : (
            contentData.contactMessages.map((m: any) => (
              <div key={m.id} className="p-4 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-[#0E5E6F]" /> {m.name} ({m.phone || m.email})</span>
                  <span className="text-[#646970] font-normal">{String(m.created_at).slice(0, 16)}</span>
                </div>
                <div className="font-semibold text-[#0E5E6F]">{m.subject}</div>
                <p className="text-[#1D2327]">{m.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
