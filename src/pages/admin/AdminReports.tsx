import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';

export const AdminReports: React.FC = () => {
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/admin/reports')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, []);

  if (!data) return <div className="h-64 bg-white rounded-xl animate-pulse" />;

  const exportCsv = () => {
    const rows = [
      'SKU,Product,UnitsSold,Revenue,NetProfit',
      ...data.productPerf.map((p: any) => `"${p.sku}","${p.name}",${p.qty},${p.revenue},${p.profit}`),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shuddho-sales-report-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1D2327]">Financial, Courier & Staff Reports</h1>
        <button type="button" onClick={exportCsv} className="px-3.5 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold inline-flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export Product Profit CSV
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        {[
          { label: 'Gross Sales', val: formatBDT(data.summary.grossSales) },
          { label: 'Net Revenue', val: formatBDT(data.summary.netSales) },
          { label: 'Discounts', val: formatBDT(data.summary.discounts) },
          { label: 'Shipping Collected', val: formatBDT(data.summary.shipping) },
          { label: 'Refunds', val: formatBDT(data.summary.refunds) },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-[#DCDCDE] p-4">
            <div className="text-[#646970]">{k.label}</div>
            <div className="text-xl font-extrabold tabular-nums mt-1">{k.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
          <h2 className="font-bold text-sm">Product Margin & Profit Performance</h2>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F7] border-b text-[#646970]">
              <tr><th className="p-2.5">Product</th><th className="p-2.5 text-right">Qty</th><th className="p-2.5 text-right">Revenue</th><th className="p-2.5 text-right">Est. Profit</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.productPerf.map((p: any) => (
                <tr key={p.sku}>
                  <td className="p-2.5 font-semibold">{p.name}</td>
                  <td className="p-2.5 text-right tabular-nums">{p.qty}</td>
                  <td className="p-2.5 text-right tabular-nums">{formatBDT(p.revenue)}</td>
                  <td className="p-2.5 text-right tabular-nums font-bold text-[#1E9E6A]">{formatBDT(p.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
            <h2 className="font-bold text-sm">Courier Delivery Performance</h2>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F7] border-b text-[#646970]">
                <tr><th className="p-2.5">Courier</th><th className="p-2.5 text-right">Total</th><th className="p-2.5 text-right">Delivered</th><th className="p-2.5 text-right">Returned</th><th className="p-2.5 text-right">COD Volume</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.courierPerf.map((c: any) => (
                  <tr key={c.courier}>
                    <td className="p-2.5 uppercase font-bold">{c.courier}</td>
                    <td className="p-2.5 text-right tabular-nums">{c.total}</td>
                    <td className="p-2.5 text-right tabular-nums text-[#1E9E6A]">{c.delivered}</td>
                    <td className="p-2.5 text-right tabular-nums text-[#E5483A]">{c.returned}</td>
                    <td className="p-2.5 text-right tabular-nums font-semibold">{formatBDT(c.codTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
            <h2 className="font-bold text-sm">Call-Centre Staff Confirmation Performance</h2>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F7] border-b text-[#646970]">
                <tr><th className="p-2.5">Staff Member</th><th className="p-2.5 text-right">Assigned</th><th className="p-2.5 text-right">Confirmed</th><th className="p-2.5 text-right">Rate</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.staffPerf.map((s: any) => (
                  <tr key={s.staff}>
                    <td className="p-2.5 font-semibold">{s.staff}</td>
                    <td className="p-2.5 text-right tabular-nums">{s.total}</td>
                    <td className="p-2.5 text-right tabular-nums font-bold">{s.confirmed}</td>
                    <td className="p-2.5 text-right tabular-nums">{s.total ? Math.round((s.confirmed / s.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
