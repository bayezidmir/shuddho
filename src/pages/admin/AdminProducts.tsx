import React, { useEffect, useState } from 'react';
import { Plus, Upload, Edit3, Trash2, Star, Check, X, Image as ImageIcon } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';
import { useStore } from '../../context/StoreContext';

export const AdminProducts: React.FC<{ initialNewModal?: boolean }> = ({ initialNewModal = false }) => {
  const { refreshBootstrap } = useStore();
  const [tab, setTab] = useState<'products' | 'categories' | 'reviews' | 'media'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Product Editor Modal
  const [editorOpen, setEditorOpen] = useState(initialNewModal);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    name_en: '',
    name_bn: '',
    sku: '',
    type: 'simple',
    status: 'published',
    featured: true,
    category_id: 'cat-honey',
    price: 750,
    regular_price: 890,
    cost_price: 450,
    stock: 30,
    short_desc_en: '',
    desc_en: '',
    images: ['/src/assets/images/hero_sundarban_honey_1794994128015.jpg'],
    badges: ['Pure Lab Tested'],
    variants: [] as Array<{ label: string; sku: string; price: number; regular_price: number; stock: number }>,
  });
  const [saving, setSaving] = useState(false);

  // Category Form
  const [catForm, setCatForm] = useState({ name_en: '', name_bn: '', slug: '', description_en: '' });

  const loadAll = async () => {
    const [pr, rr] = await Promise.all([fetch('/api/admin/products'), fetch('/api/admin/reviews')]);
    if (pr.ok) {
      const d = await pr.json();
      setProducts(d.products || []);
      setCategories(d.categories || []);
      setMedia(d.media || []);
    }
    if (rr.ok) {
      const d = await rr.json();
      setReviews(d.reviews || []);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name_en: '',
      name_bn: '',
      sku: `SH-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'simple',
      status: 'published',
      featured: true,
      category_id: categories[0]?.id || 'cat-honey',
      price: 650,
      regular_price: 750,
      cost_price: 400,
      stock: 25,
      short_desc_en: '',
      desc_en: '',
      images: ['/src/assets/images/hero_sundarban_honey_1794994128015.jpg'],
      badges: ['100% Pure'],
      variants: [],
    });
    setEditorOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name_en: p.name_en,
      name_bn: p.name_bn,
      sku: p.sku,
      type: p.type || 'simple',
      status: p.status,
      featured: Boolean(p.featured),
      category_id: p.category_id,
      price: p.price,
      regular_price: p.regular_price,
      cost_price: p.cost_price,
      stock: p.stock,
      short_desc_en: p.short_desc_en,
      desc_en: p.desc_en,
      images: p.images?.length ? p.images : ['/src/assets/images/hero_sundarban_honey_1794994128015.jpg'],
      badges: p.badges || [],
      variants: p.variants || [],
    });
    setEditorOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const resp = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, dataUrl, altText: form.name_en || file.name }),
      });
      if (resp.ok) {
        const d = await resp.json();
        setForm((prev: any) => ({ ...prev, images: [d.media.url, ...(prev.images || [])] }));
        loadAll();
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
    const method = editingId ? 'PUT' : 'POST';
    const payload = {
      ...form,
      type: form.variants.length > 0 ? 'variable' : form.type,
    };
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (r.ok) {
      setEditorOpen(false);
      await loadAll();
      await refreshBootstrap();
    }
  };

  const deleteProduct = async (id: string) => {
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    await loadAll();
    await refreshBootstrap();
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catForm),
    });
    if (r.ok) {
      setCatForm({ name_en: '', name_bn: '', slug: '', description_en: '' });
      await loadAll();
      await refreshBootstrap();
    }
  };

  const moderateReview = async (id: string, status: string) => {
    await fetch(`/api/admin/reviews/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAll();
  };

  const filteredProducts = products.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name_en.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#1D2327]">Products & Catalog</h1>
          <div className="flex rounded-lg bg-white border border-[#DCDCDE] p-0.5 text-xs">
            {[
              { id: 'products', label: `Products (${products.length})` },
              { id: 'categories', label: `Categories (${categories.length})` },
              { id: 'reviews', label: `Reviews (${reviews.length})` },
              { id: 'media', label: `Media (${media.length})` },
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
        <button
          type="button"
          onClick={openCreate}
          className="px-3.5 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Product
        </button>
      </div>

      {tab === 'products' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#DCDCDE] text-xs">
            <div className="flex gap-2">
              {['all', 'published', 'draft'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded capitalize font-semibold ${statusFilter === st ? 'bg-[#0E5E6F] text-white' : 'text-[#646970]'}`}
                >
                  {st}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or SKU..."
              className="px-3 py-1.5 rounded-lg border border-[#DCDCDE] w-56"
            />
          </div>

          <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F6F7F7] border-b border-[#DCDCDE] text-[#646970]">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F1]">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F9FAFB]">
                    <td className="p-3 flex items-center gap-2.5">
                      <img src={p.images?.[0] || ''} alt={p.name_en} className="w-10 h-10 rounded-lg object-cover bg-[#E0EDEE]" />
                      <div>
                        <div className="font-bold text-[#1D2327]">{p.name_en}</div>
                        <div className="text-[11px] text-[#646970]">{p.name_bn}</div>
                      </div>
                    </td>
                    <td className="p-3 font-mono">{p.sku}</td>
                    <td className="p-3">{p.category?.name_en || '—'}</td>
                    <td className="p-3 capitalize">
                      {p.type} {p.variants?.length ? `(${p.variants.length} vars)` : ''}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      <span className={p.stock <= p.low_stock_threshold ? 'text-[#E5483A] font-bold' : 'font-semibold'}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums font-bold">{formatBDT(p.price)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === 'published' ? 'bg-[#E6F7EF] text-[#1E9E6A]' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(p)} className="px-2 py-1 rounded border border-[#DCDCDE] inline-flex items-center gap-1 hover:bg-[#F6F7F7]">
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button type="button" onClick={() => deleteProduct(p.id)} className="px-2 py-1 rounded border border-[#F8B4AC] text-[#A3271B] inline-flex items-center">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <form onSubmit={addCategory} className="md:col-span-4 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
            <h2 className="font-bold text-sm">Add New Category</h2>
            <input type="text" required placeholder="Name (English)" value={catForm.name_en} onChange={(e) => setCatForm({ ...catForm, name_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-xs" />
            <input type="text" placeholder="Name (বাংলা)" value={catForm.name_bn} onChange={(e) => setCatForm({ ...catForm, name_bn: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-xs" />
            <input type="text" placeholder="URL slug (optional)" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-xs font-mono" />
            <textarea placeholder="Description" value={catForm.description_en} onChange={(e) => setCatForm({ ...catForm, description_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-xs" rows={2} />
            <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold">Add Category</button>
          </form>
          <div className="md:col-span-8 bg-white rounded-xl border border-[#DCDCDE] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F7] border-b"><tr><th className="p-3">Category</th><th className="p-3">Bangla</th><th className="p-3">Slug</th></tr></thead>
              <tbody className="divide-y">
                {categories.map((c) => (
                  <tr key={c.id}><td className="p-3 font-bold">{c.name_en}</td><td className="p-3">{c.name_bn}</td><td className="p-3 font-mono text-[#646970]">{c.slug}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] divide-y">
          {reviews.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#646970]">No customer reviews yet.</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 font-bold">
                    <span>{r.customer_name}</span>
                    <span className="inline-flex items-center text-amber-500"><Star className="w-3 h-3 fill-current mr-0.5" />{r.rating}</span>
                    <span className="text-[#646970] font-normal">on {r.product_name}</span>
                  </div>
                  <p className="text-[#1D2327] mt-1">{r.comment}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.status === 'approved' ? 'bg-[#E6F7EF] text-[#1E9E6A]' : 'bg-[#FFF4E5] text-[#B45309]'}`}>
                    {r.status}
                  </span>
                  <button type="button" onClick={() => moderateReview(r.id, 'approved')} className="px-2.5 py-1 rounded bg-[#1E9E6A] text-white font-semibold inline-flex items-center gap-1"><Check className="w-3 h-3" /> Approve</button>
                  <button type="button" onClick={() => moderateReview(r.id, 'rejected')} className="px-2.5 py-1 rounded border text-[#A3271B] inline-flex items-center gap-1"><X className="w-3 h-3" /> Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'media' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm">Media Library</h2>
            <label className="px-3 py-1.5 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload Image
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {media.map((m) => (
              <div key={m.id} className="border rounded-lg p-2 text-[11px] space-y-1">
                <img src={m.url} alt={m.alt_text} className="w-full h-24 object-cover rounded bg-[#EEF5F5]" />
                <div className="truncate font-mono">{m.filename}</div>
              </div>
            ))}
            {media.length === 0 && (
              <div className="col-span-full py-10 text-center text-xs text-[#646970]">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Upload product photos from your computer to store locally in /uploads.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Create / Edit Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditorOpen(false)}>
          <form
            onSubmit={saveProduct}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-xl bg-white p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold">{editingId ? 'Edit Product' : 'Create New Product'}</h2>
              <button type="button" onClick={() => setEditorOpen(false)} className="text-xs font-semibold">Close</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Product Name (English) *</label>
                <input type="text" required value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Product Name (বাংলা)</label>
                <input type="text" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block font-semibold mb-1">SKU</label>
                <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Category</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Sale Price (৳) *</label>
                <input type="number" required value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Regular Price (৳)</label>
                <input type="number" value={form.regular_price} onChange={(e) => setForm({ ...form, regular_price: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Cost Price (COGS ৳)</label>
                <input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Stock Quantity</label>
                <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border" />
              </div>
            </div>

            <div className="text-xs space-y-2">
              <label className="block font-semibold">Short Description</label>
              <input type="text" value={form.short_desc_en} onChange={(e) => setForm({ ...form, short_desc_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
              <label className="block font-semibold">Full Description</label>
              <textarea rows={3} value={form.desc_en} onChange={(e) => setForm({ ...form, desc_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            </div>

            {/* Product Image Upload + URL */}
            <div className="p-3 rounded-lg bg-[#F6F7F7] border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold">Product Images</span>
                <label className="px-2.5 py-1 rounded bg-[#0E5E6F] text-white font-semibold cursor-pointer inline-flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Upload from Computer
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.images || []).map((img: string, idx: number) => (
                  <img key={idx} src={img} alt="Product" className="w-14 h-14 rounded object-cover border bg-white" />
                ))}
              </div>
            </div>

            {/* Variants Section */}
            <div className="p-3 rounded-lg bg-[#F6F7F7] border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold">Weight / Size Variants ({form.variants.length})</span>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      variants: [
                        ...form.variants,
                        { label: '500g', sku: `${form.sku || 'SH'}-${form.variants.length + 1}`, price: form.price, regular_price: form.regular_price, stock: 20 },
                      ],
                    })
                  }
                  className="px-2.5 py-1 rounded border bg-white font-semibold"
                >
                  + Add Variant
                </button>
              </div>
              {form.variants.map((v: any, idx: number) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                  <input type="text" placeholder="Label (e.g. 500g)" value={v.label} onChange={(e) => {
                    const next = [...form.variants];
                    next[idx] = { ...v, label: e.target.value };
                    setForm({ ...form, variants: next });
                  }} className="px-2 py-1.5 rounded border bg-white" />
                  <input type="text" placeholder="SKU" value={v.sku} onChange={(e) => {
                    const next = [...form.variants];
                    next[idx] = { ...v, sku: e.target.value };
                    setForm({ ...form, variants: next });
                  }} className="px-2 py-1.5 rounded border bg-white font-mono" />
                  <input type="number" placeholder="Price" value={v.price} onChange={(e) => {
                    const next = [...form.variants];
                    next[idx] = { ...v, price: Number(e.target.value) };
                    setForm({ ...form, variants: next });
                  }} className="px-2 py-1.5 rounded border bg-white" />
                  <input type="number" placeholder="Stock" value={v.stock} onChange={(e) => {
                    const next = [...form.variants];
                    next[idx] = { ...v, stock: Number(e.target.value) };
                    setForm({ ...form, variants: next });
                  }} className="px-2 py-1.5 rounded border bg-white" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, variants: form.variants.filter((_: any, i: number) => i !== idx) })}
                    className="text-[#A3271B] font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 font-semibold">
                  <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                  Featured on Homepage
                </label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-2.5 py-1 rounded border">
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold">
                {saving ? 'Saving...' : editingId ? 'Update Product' : 'Publish Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
