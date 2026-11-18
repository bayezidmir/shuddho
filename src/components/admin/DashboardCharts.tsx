import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Layers, RotateCcw } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';
import type {
  TimeSeriesPoint,
  StatusBreakdownItem,
  PaymentBreakdownItem,
  SourceBreakdownItem,
  DistrictBreakdownItem,
  TopProductItem,
  CourierBreakdownItem,
} from '../../lib/dashboard-analytics';

type ChartStyle = 'area' | 'bar';
type ChartMetric = 'both' | 'sales' | 'orders';

function formatCompactBDT(val: number): string {
  if (val >= 100_000) return `৳${(val / 1000).toFixed(0)}k`;
  if (val >= 1000) return `৳${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return `৳${Math.round(val)}`;
}

function niceMax(rawMax: number, minFloor = 4): number {
  const safe = Math.max(rawMax, minFloor);
  const magnitude = Math.pow(10, Math.floor(Math.log10(safe)));
  const norm = safe / magnitude;
  if (norm <= 1.2) return 1.2 * magnitude;
  if (norm <= 1.5) return 1.5 * magnitude;
  if (norm <= 2) return 2 * magnitude;
  if (norm <= 2.5) return 2.5 * magnitude;
  if (norm <= 3) return 3 * magnitude;
  if (norm <= 5) return 5 * magnitude;
  if (norm <= 8) return 8 * magnitude;
  return 10 * magnitude;
}

export const RevenueTrendChart: React.FC<{
  series: TimeSeriesPoint[];
  granularity: 'hour' | 'day';
  onGranularityChange: (g: 'hour' | 'day') => void;
  rangeLabel: string;
  onResetFilter: () => void;
}> = ({ series, granularity, onGranularityChange, rangeLabel, onResetFilter }) => {
  const [chartStyle, setChartStyle] = useState<ChartStyle>('area');
  const [metric, setMetric] = useState<ChartMetric>('both');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hasData = useMemo(() => series.some((p) => p.orders > 0 || p.sales > 0), [series]);

  const width = 760;
  const height = 264;
  const pad = { top: 20, right: 44, bottom: 34, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxSales = useMemo(
    () => niceMax(Math.max(...series.map((s) => s.sales), 0), 1000),
    [series],
  );
  const maxOrders = useMemo(
    () => Math.max(4, Math.ceil(Math.max(...series.map((s) => s.orders), 0) * 1.25)),
    [series],
  );

  const n = Math.max(1, series.length);
  const stepX = n > 1 ? plotW / n : plotW;
  const xCenter = (i: number) => (n === 1 ? pad.left + plotW / 2 : pad.left + stepX * i + stepX / 2);

  const ySales = (val: number) => pad.top + plotH - (val / maxSales) * plotH;
  const yOrders = (val: number) => pad.top + plotH - (val / maxOrders) * plotH;

  const salesPoints = series.map((p, i) => ({ x: xCenter(i), y: ySales(p.sales) }));
  const linePath =
    salesPoints.length > 0
      ? salesPoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
      : '';
  const areaPath =
    salesPoints.length > 0
      ? `${linePath} L ${salesPoints[salesPoints.length - 1].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${salesPoints[0].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
      : '';

  const ordersPoints = series.map((p, i) => ({ x: xCenter(i), y: yOrders(p.orders) }));
  const ordersLinePath =
    ordersPoints.length > 0
      ? ordersPoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
      : '';
  const ordersAreaPath =
    ordersPoints.length > 0
      ? `${ordersLinePath} L ${ordersPoints[ordersPoints.length - 1].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${ordersPoints[0].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
      : '';

  const labelInterval = n <= 10 ? 1 : n <= 16 ? 2 : n <= 24 ? 3 : Math.ceil(n / 8);
  const activePoint = hoverIdx !== null && series[hoverIdx] ? series[hoverIdx] : null;
  const barWidth = Math.max(6, Math.min(34, stepX * 0.56));

  return (
    <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 sm:p-5 flex flex-col justify-between space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className="font-bold text-sm text-[#1D2327]">Revenue &amp; Order Volume Trend</h2>
          <p className="text-xs text-[#646970] truncate">
            {rangeLabel} · {granularity === 'hour' ? 'Hourly breakdown (UTC)' : 'Daily performance'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Metric Selector */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#F0F2F4] border border-[#DCDCDE]" role="group" aria-label="Chart metric">
            {[
              { id: 'both', label: 'Combined' },
              { id: 'sales', label: 'Revenue' },
              { id: 'orders', label: 'Orders' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id as ChartMetric)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  metric === m.id ? 'bg-white text-[#1D2327] shadow-xs font-semibold' : 'text-[#646970] hover:text-[#1D2327]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#F0F2F4] border border-[#DCDCDE]" role="group" aria-label="Chart visualization style">
            <button
              type="button"
              onClick={() => setChartStyle('area')}
              aria-label="Area trend view"
              className={`px-2 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                chartStyle === 'area' ? 'bg-white text-[#0E5E6F] shadow-xs font-semibold' : 'text-[#646970] hover:text-[#1D2327]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Area</span>
            </button>
            <button
              type="button"
              onClick={() => setChartStyle('bar')}
              aria-label="Bar chart view"
              className={`px-2 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                chartStyle === 'bar' ? 'bg-white text-[#0E5E6F] shadow-xs font-semibold' : 'text-[#646970] hover:text-[#1D2327]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Bars</span>
            </button>
          </div>

          {/* Granularity Toggle */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#F0F2F4] border border-[#DCDCDE]" role="group" aria-label="Time granularity">
            <button
              type="button"
              onClick={() => onGranularityChange('day')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                granularity === 'day' ? 'bg-white text-[#1D2327] shadow-xs font-semibold' : 'text-[#646970] hover:text-[#1D2327]'
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => onGranularityChange('hour')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                granularity === 'hour' ? 'bg-white text-[#1D2327] shadow-xs font-semibold' : 'text-[#646970] hover:text-[#1D2327]'
              }`}
            >
              Hourly
            </button>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[264px] rounded-lg border border-dashed border-[#DCDCDE] bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center space-y-3">
          <Layers className="w-7 h-7 text-[#94A3B8]" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#1D2327]">No order activity in this date window</p>
            <p className="text-xs text-[#646970]">Adjust the date picker above or reset to view recent sales and order volume.</p>
          </div>
          <button
            type="button"
            onClick={onResetFilter}
            className="px-3.5 py-1.5 rounded-lg bg-[#0E5E6F] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Last 7 Days</span>
          </button>
        </div>
      ) : (
        <div className="relative" data-testid="revenue-trend-chart">
          {/* Interactive Hover Readout Bar */}
          <div className="mb-2 min-h-[28px] px-3 py-1.5 rounded-lg bg-[#F6F7F7] border border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-xs">
            {activePoint ? (
              <>
                <span className="font-bold text-[#1D2327] tabular-nums">{activePoint.label}</span>
                <div className="flex flex-wrap items-center gap-4 tabular-nums">
                  <span className="text-[#0E5E6F] font-semibold">
                    Valid Revenue: <strong>{formatBDT(activePoint.sales)}</strong>
                  </span>
                  <span className="text-[#1D2327]">
                    Orders: <strong>{activePoint.orders}</strong>
                    {activePoint.cancelled > 0 && (
                      <span className="text-[#E5483A]"> ({activePoint.cancelled} cancelled)</span>
                    )}
                  </span>
                  <span className="text-[#646970]">
                    AOV: <strong className="text-[#1D2327]">{formatBDT(activePoint.aov)}</strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 text-[#646970]">
                  {(metric === 'both' || metric === 'sales') && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#0E5E6F] inline-block" />
                      <span>Valid Revenue (৳)</span>
                    </span>
                  )}
                  {(metric === 'both' || metric === 'orders') && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#FF6B5B] inline-block" />
                      <span>Order Volume</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#646970]">Hover any point or bar for period breakdown</span>
              </>
            )}
          </div>

          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
            role="img"
            aria-label={`Revenue and orders chart for ${rangeLabel}`}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="shuddhoSalesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0E5E6F" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#0E5E6F" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="shuddhoOrdersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B5B" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#FF6B5B" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Left/Right Axis Labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = pad.top + plotH * (1 - t);
              const salesTick = maxSales * t;
              const orderTick = Math.round(maxOrders * t);
              return (
                <g key={t}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={pad.left + plotW}
                    y2={y}
                    stroke={t === 0 ? '#CBD5E1' : '#E2E8F0'}
                    strokeDasharray={t === 0 ? undefined : '3 3'}
                    strokeWidth={1}
                  />
                  <text
                    x={pad.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-[#646970] text-[10px] tabular-nums"
                  >
                    {metric === 'orders' ? orderTick : formatCompactBDT(salesTick)}
                  </text>
                  {metric === 'both' && (
                    <text
                      x={pad.left + plotW + 8}
                      y={y + 4}
                      textAnchor="start"
                      className="fill-[#94A3B8] text-[10px] tabular-nums"
                    >
                      {orderTick}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Right axis title in Combined mode */}
            {metric === 'both' && (
              <text
                x={pad.left + plotW + 8}
                y={10}
                textAnchor="start"
                className="fill-[#94A3B8] text-[9px] font-semibold"
              >
                Orders
              </text>
            )}

            {/* Hover Column Highlight */}
            {hoverIdx !== null && series[hoverIdx] && (
              <line
                x1={xCenter(hoverIdx)}
                y1={pad.top}
                x2={xCenter(hoverIdx)}
                y2={pad.top + plotH}
                stroke="#0E5E6F"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
              />
            )}

            {/* Combined Background Order Bars */}
            {metric === 'both' &&
              series.map((p, i) => {
                const barH = Math.max(0, (p.orders / maxOrders) * plotH);
                const bx = xCenter(i) - (chartStyle === 'bar' ? 0 : barWidth / 2);
                const bw = chartStyle === 'bar' ? Math.max(4, barWidth * 0.44) : barWidth;
                if (barH <= 0) return null;
                return (
                  <rect
                    key={`ob-${p.key}`}
                    x={chartStyle === 'bar' ? xCenter(i) + 1 : bx}
                    y={pad.top + plotH - barH}
                    width={bw}
                    height={barH}
                    rx={3}
                    fill="#FF6B5B"
                    fillOpacity={hoverIdx === i ? 0.78 : chartStyle === 'bar' ? 0.85 : 0.25}
                  />
                );
              })}

            {/* Sales Visualization */}
            {(metric === 'sales' || metric === 'both') &&
              (chartStyle === 'area' ? (
                <>
                  {areaPath && <path d={areaPath} fill="url(#shuddhoSalesGrad)" />}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#0E5E6F"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {series.map((p, i) => (
                    <circle
                      key={`sp-${p.key}`}
                      cx={xCenter(i)}
                      cy={ySales(p.sales)}
                      r={hoverIdx === i ? 5 : p.sales > 0 ? 3 : 1.5}
                      fill={p.sales > 0 || hoverIdx === i ? '#0E5E6F' : '#CBD5E1'}
                      stroke="#FFFFFF"
                      strokeWidth={hoverIdx === i ? 2 : 1.2}
                    />
                  ))}
                </>
              ) : (
                series.map((p, i) => {
                  const barH = Math.max(0, (p.sales / maxSales) * plotH);
                  const bw = metric === 'both' ? Math.max(4, barWidth * 0.48) : barWidth;
                  const bx = metric === 'both' ? xCenter(i) - bw - 1 : xCenter(i) - bw / 2;
                  if (barH <= 0) return null;
                  return (
                    <rect
                      key={`sb-${p.key}`}
                      x={bx}
                      y={pad.top + plotH - barH}
                      width={bw}
                      height={barH}
                      rx={3}
                      fill="#0E5E6F"
                      fillOpacity={hoverIdx === i ? 1 : 0.88}
                    />
                  );
                })
              ))}

            {/* Orders-Only Visualization */}
            {metric === 'orders' &&
              (chartStyle === 'area' ? (
                <>
                  {ordersAreaPath && <path d={ordersAreaPath} fill="url(#shuddhoOrdersGrad)" />}
                  {ordersLinePath && (
                    <path
                      d={ordersLinePath}
                      fill="none"
                      stroke="#FF6B5B"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {series.map((p, i) => (
                    <circle
                      key={`op-${p.key}`}
                      cx={xCenter(i)}
                      cy={yOrders(p.orders)}
                      r={hoverIdx === i ? 5 : p.orders > 0 ? 3 : 1.5}
                      fill={p.orders > 0 || hoverIdx === i ? '#FF6B5B' : '#CBD5E1'}
                      stroke="#FFFFFF"
                      strokeWidth={hoverIdx === i ? 2 : 1.2}
                    />
                  ))}
                </>
              ) : (
                series.map((p, i) => {
                  const barH = Math.max(0, (p.orders / maxOrders) * plotH);
                  if (barH <= 0) return null;
                  return (
                    <rect
                      key={`oob-${p.key}`}
                      x={xCenter(i) - barWidth / 2}
                      y={pad.top + plotH - barH}
                      width={barWidth}
                      height={barH}
                      rx={3}
                      fill="#FF6B5B"
                      fillOpacity={hoverIdx === i ? 1 : 0.88}
                    />
                  );
                })
              ))}

            {/* X-Axis Labels */}
            {series.map((p, i) => {
              const show = i === 0 || i === series.length - 1 || i % labelInterval === 0;
              if (!show) return null;
              return (
                <text
                  key={`xl-${p.key}`}
                  x={xCenter(i)}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-[#646970] text-[10px] tabular-nums"
                >
                  {p.shortLabel}
                </text>
              );
            })}

            {/* Full-Column Interactive Hit Targets */}
            {series.map((p, i) => (
              <rect
                key={`hit-${p.key}`}
                x={pad.left + stepX * i}
                y={pad.top}
                width={stepX}
                height={plotH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIdx(i)}
                onClick={() => setHoverIdx(i)}
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

export const OrderStatusDonutChart: React.FC<{
  breakdown: StatusBreakdownItem[];
  totalOrders: number;
  confirmationRate: number;
  onNavigateOrders: () => void;
}> = ({ breakdown, totalOrders, confirmationRate, onNavigateOrders }) => {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const activeItem = hoveredStatus ? breakdown.find((b) => b.status === hoveredStatus) : null;

  let cumulativeOffset = 0;
  const segments = breakdown.map((item) => {
    const frac = totalOrders > 0 ? item.count / totalOrders : 0;
    const length = frac * circumference;
    const seg = {
      ...item,
      dashArray: `${Math.max(0, length - 1.5)} ${circumference}`,
      dashOffset: -cumulativeOffset,
    };
    cumulativeOffset += length;
    return seg;
  });

  return (
    <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 sm:p-5 flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-sm text-[#1D2327]">Order Status Pipeline</h2>
          <p className="text-xs text-[#646970]">Fulfillment distribution in period</p>
        </div>
        <button
          type="button"
          onClick={onNavigateOrders}
          className="text-xs font-semibold text-[#0E5E6F] hover:underline whitespace-nowrap shrink-0"
        >
          Manage Orders
        </button>
      </div>

      {totalOrders === 0 ? (
        <div className="py-12 text-center text-xs text-[#646970]">No orders placed in this range.</div>
      ) : (
        <>
          <div className="flex items-center justify-center py-1">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90" role="img" aria-label="Order status donut chart">
                <circle cx="75" cy="75" r={radius} fill="none" stroke="#F0F2F4" strokeWidth="18" />
                {segments.map((seg) => (
                  <circle
                    key={seg.status}
                    cx="75"
                    cy="75"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoveredStatus === seg.status ? 21 : 18}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    className="transition-all duration-150 cursor-pointer"
                    onMouseEnter={() => setHoveredStatus(seg.status)}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                <div className="text-2xl font-extrabold text-[#1D2327] tabular-nums">
                  {activeItem ? activeItem.count : totalOrders}
                </div>
                <div className="text-[11px] font-medium text-[#646970] leading-tight">
                  {activeItem ? activeItem.label : `${confirmationRate}% confirmed`}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {breakdown.map((item) => (
              <div
                key={item.status}
                onMouseEnter={() => setHoveredStatus(item.status)}
                onMouseLeave={() => setHoveredStatus(null)}
                className="space-y-1 cursor-default"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-[#1D2327]">
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </span>
                  <span className="tabular-nums text-[#646970]">
                    <strong className="text-[#1D2327]">{item.count}</strong> · {item.sharePct}% · {formatBDT(item.revenue)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F0F2F4] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${Math.max(4, item.sharePct)}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const AttributionBarChart: React.FC<{
  bySource: SourceBreakdownItem[];
  totalSales: number;
}> = ({ bySource, totalSales }) => {
  const maxRev = Math.max(1, ...bySource.map((s) => s.revenue));

  return (
    <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-bold text-sm text-[#1D2327]">Revenue by Acquisition Source</h2>
        <p className="text-xs text-[#646970]">UTM &amp; click-ID channel attribution</p>
      </div>

      {bySource.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#646970]">No attributed sales in this date range.</div>
      ) : (
        <>
          {/* Proportion Strip */}
          <div className="h-2.5 rounded-full bg-[#F0F2F4] overflow-hidden flex gap-0.5" aria-hidden="true">
            {bySource.map((s) => (
              <div
                key={s.source}
                style={{
                  width: `${totalSales > 0 ? Math.max(4, (s.revenue / totalSales) * 100) : 0}%`,
                  backgroundColor: s.color,
                }}
              />
            ))}
          </div>

          <div className="space-y-3">
            {bySource.map((s) => (
              <div key={s.source} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="flex items-center gap-2 font-semibold text-[#1D2327]">
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: s.color }} />
                    <span>{s.label}</span>
                  </span>
                  <span className="tabular-nums text-[#646970] whitespace-nowrap">
                    {s.orders} {s.orders === 1 ? 'order' : 'orders'} ·{' '}
                    <strong className="text-[#1D2327]">{formatBDT(s.revenue)}</strong> ({s.sharePct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#F0F2F4] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, Math.round((s.revenue / maxRev) * 100))}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const PaymentMixChart: React.FC<{
  paymentBreakdown: PaymentBreakdownItem[];
  paidTotal: number;
  codReceivable: number;
}> = ({ paymentBreakdown, paidTotal, codReceivable }) => {
  const totalVol = Math.max(1, paidTotal + codReceivable);
  const collectedPct = Math.round((paidTotal / totalVol) * 100);

  return (
    <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-bold text-sm text-[#1D2327]">Payment Method &amp; Collection Mix</h2>
        <p className="text-xs text-[#646970]">Prepaid gateways vs COD receivable</p>
      </div>

      {paymentBreakdown.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#646970]">No valid order payments in this range.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#F0F0F1]">
            <div>
              <div className="text-[11px] text-[#646970]">Collected ({collectedPct}%)</div>
              <div className="text-base font-extrabold text-[#1E9E6A] tabular-nums">{formatBDT(paidTotal)}</div>
            </div>
            <div>
              <div className="text-[11px] text-[#646970]">COD Pending ({100 - collectedPct}%)</div>
              <div className="text-base font-extrabold text-[#D97706] tabular-nums">{formatBDT(codReceivable)}</div>
            </div>
          </div>

          <div className="h-2.5 rounded-full bg-[#F0F2F4] overflow-hidden flex gap-0.5" aria-hidden="true">
            {paymentBreakdown.map((p) => (
              <div
                key={p.method}
                style={{ width: `${Math.max(4, p.sharePct)}%`, backgroundColor: p.color }}
              />
            ))}
          </div>

          <div className="space-y-2.5">
            {paymentBreakdown.map((p) => (
              <div key={p.method} className="flex items-center justify-between text-xs gap-2">
                <span className="flex items-center gap-2 font-semibold text-[#1D2327]">
                  <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: p.color }} />
                  <span>{p.label}</span>
                </span>
                <span className="tabular-nums text-[#646970] whitespace-nowrap">
                  {p.orders} {p.orders === 1 ? 'order' : 'orders'} ·{' '}
                  <strong className="text-[#1D2327]">{formatBDT(p.total)}</strong> ({p.sharePct}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const DistrictBarChart: React.FC<{
  byDistrict: DistrictBreakdownItem[];
}> = ({ byDistrict }) => {
  const maxRev = Math.max(1, ...byDistrict.map((d) => d.revenue));

  return (
    <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-bold text-sm text-[#1D2327]">Top Districts by Revenue</h2>
        <p className="text-xs text-[#646970]">Bangladesh 64-district demand spread</p>
      </div>

      {byDistrict.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#646970]">No district sales data in this range.</div>
      ) : (
        <div className="space-y-2.5">
          {byDistrict.map((d, idx) => (
            <div key={d.district} className="space-y-1">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-semibold text-[#1D2327] truncate">
                  {idx + 1}. {d.district}
                </span>
                <span className="tabular-nums text-[#646970] whitespace-nowrap">
                  {d.orders} {d.orders === 1 ? 'order' : 'orders'} ·{' '}
                  <strong className="text-[#1D2327]">{formatBDT(d.revenue)}</strong>
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#F0F2F4] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0E5E6F]"
                  style={{
                    width: `${Math.max(5, Math.round((d.revenue / maxRev) * 100))}%`,
                    opacity: Math.max(0.45, 1 - idx * 0.1),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const TopProductsCard: React.FC<{
  products: TopProductItem[];
  onNavigateProducts: () => void;
}> = ({ products, onNavigateProducts }) => {
  const maxRev = Math.max(1, ...products.map((p) => p.revenue));

  return (
    <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-sm text-[#1D2327]">Top Selling Products</h2>
          <p className="text-xs text-[#646970]">Units, revenue &amp; estimated gross profit</p>
        </div>
        <button
          type="button"
          onClick={onNavigateProducts}
          className="text-xs font-semibold text-[#0E5E6F] hover:underline whitespace-nowrap shrink-0"
        >
          Catalog
        </button>
      </div>

      {products.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#646970]">No products sold in this date range.</div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.productId + p.sku} className="space-y-1">
              <div className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-[#1D2327] truncate">{p.name}</div>
                  <div className="text-[11px] text-[#646970] tabular-nums">
                    {p.sku} · {p.units} {p.units === 1 ? 'unit' : 'units'} · Margin {p.marginPct}%
                  </div>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <div className="font-bold text-[#1D2327]">{formatBDT(p.revenue)}</div>
                  <div className="text-[11px] font-semibold text-[#1E9E6A]">+{formatBDT(p.profit)}</div>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-[#F0F2F4] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1E9E6A]"
                  style={{ width: `${Math.max(4, Math.round((p.revenue / maxRev) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CourierPerformanceCard: React.FC<{
  couriers: CourierBreakdownItem[];
  onNavigateCouriers: () => void;
}> = ({ couriers, onNavigateCouriers }) => {
  return (
    <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-sm text-[#1D2327]">Courier Dispatch Breakdown</h2>
          <p className="text-xs text-[#646970]">Parcel allocation across carriers</p>
        </div>
        <button
          type="button"
          onClick={onNavigateCouriers}
          className="text-xs font-semibold text-[#0E5E6F] hover:underline whitespace-nowrap shrink-0"
        >
          Couriers
        </button>
      </div>

      {couriers.length === 0 ? (
        <div className="py-6 text-center text-xs text-[#646970]">No courier bookings in this date range.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E5E7EB] text-[#646970]">
              <tr>
                <th className="py-2 pr-2 font-semibold">Carrier</th>
                <th className="py-2 px-2 text-right font-semibold">Orders</th>
                <th className="py-2 px-2 text-right font-semibold">Delivered</th>
                <th className="py-2 px-2 text-right font-semibold">Transit</th>
                <th className="py-2 pl-2 text-right font-semibold">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F1] tabular-nums">
              {couriers.map((c) => (
                <tr key={c.courier}>
                  <td className="py-2 pr-2 font-semibold text-[#1D2327]">{c.label}</td>
                  <td className="py-2 px-2 text-right">{c.orders}</td>
                  <td className="py-2 px-2 text-right font-semibold text-[#1E9E6A]">{c.delivered}</td>
                  <td className="py-2 px-2 text-right text-[#0E5E6F]">{c.inTransit}</td>
                  <td className="py-2 pl-2 text-right font-bold text-[#1D2327]">{formatBDT(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
