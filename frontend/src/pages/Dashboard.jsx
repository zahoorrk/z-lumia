import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtINR, statusLabel } from "@/lib/constants";
import { TrendUp, Money, Package, CheckCircle, Clock, Warning, Factory, Wrench, ArrowDown } from "@phosphor-icons/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const KPI_COLORS = ["#0F3BE8", "#FF4B00", "#16A34A", "#0284C7", "#7C3AED", "#DC2626"];

const legendFormatter = (value) => (
  <span className="text-xs text-slate-700">{statusLabel(value)}</span>
);

function KPI({ label, value, Icon, accent = "#0F3BE8", sub, testid }) {
  return (
    <div className="lumia-surface p-5 relative overflow-hidden" data-testid={testid}>
      <div className="absolute top-0 left-0 w-1 h-full" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</div>
        <Icon size={18} weight="bold" style={{ color: accent }} />
      </div>
      <div className="mt-3 text-2xl xl:text-3xl font-black tracking-tighter text-slate-900 font-mono-num">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/dashboard/stats").then((r) => setStats(r.data)).finally(() => setLoading(false)); }, []);

  if (loading || !stats) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <div className="h-8 w-48 bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3,4,5,6,7].map((i) => <div key={i} className="h-28 bg-white border border-slate-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="dashboard">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Operations Overview</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Control Room</h1>
        </div>
        <div className="text-xs text-slate-500">Live snapshot · refreshed just now</div>
      </div>

      {/* KPIs - 2 rows of 4 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI testid="kpi-revenue" label="Total Revenue" value={fmtINR(stats.revenue)} Icon={Money} accent="#0F3BE8" sub="Completed projects" />
        <KPI testid="kpi-profit" label="Net Profit" value={fmtINR(stats.profit)} Icon={TrendUp} accent="#16A34A" sub="Revenue − Costs" />
        <KPI testid="kpi-pending" label="Pending Projects" value={stats.pending_projects} Icon={Clock} accent="#FF4B00" sub={`${stats.total_projects} total`} />
        <KPI testid="kpi-completed" label="Completed" value={stats.completed_projects} Icon={CheckCircle} accent="#0284C7" sub="Delivered" />
        <KPI testid="kpi-inventory-value" label="Inventory Value" value={fmtINR(stats.inventory_value)} Icon={Package} accent="#7C3AED" sub="Stock × Purchase rate" />
        <KPI testid="kpi-low-stock" label="Low Stock" value={stats.low_stock_count} Icon={Warning} accent="#DC2626" sub="Below minimum" />
        <KPI testid="kpi-prod-in-progress" label="Production In Progress" value={stats.production_in_progress} Icon={Factory} accent="#FF4B00" sub="Active jobs" />
        <KPI testid="kpi-installations" label="Installs (Pending/Done)" value={`${stats.installations_pending} / ${stats.installations_completed}`} Icon={Wrench} accent="#0F3BE8" sub="Pending vs completed" />
      </div>

      {/* Margin alerts */}
      {stats.margin_alerts?.length > 0 && (
        <div className="lumia-surface border-l-4 border-l-red-600" data-testid="margin-alerts">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-red-50/40">
            <div className="flex items-center gap-2">
              <ArrowDown size={18} weight="fill" className="text-red-600" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Profit Watch</div>
                <h3 className="text-base font-bold tracking-tight">
                  {stats.margin_alerts.length} project(s) below <span className="text-red-600 font-mono-num">{stats.margin_threshold}%</span> margin
                </h3>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {stats.margin_alerts.map((m) => (
              <div key={m.project_id} className="p-3" data-testid={`margin-alert-${m.project_id}`}>
                <div className="font-mono-num text-xs text-slate-500">{m.project_no}</div>
                <div className="text-sm font-semibold text-slate-900 truncate">{m.name}</div>
                <div className={`mt-1 font-mono-num font-black text-lg ${m.margin_pct < 0 ? "text-red-700" : "text-amber-700"}`}>{m.margin_pct}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lumia-surface p-5 lg:col-span-8">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Trend</div>
          <h3 className="text-lg font-bold tracking-tight">Revenue, completed projects</h3>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue_trend}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F3BE8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0F3BE8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#0F172A", border: "none", color: "#fff", fontSize: 12 }} formatter={(v) => fmtINR(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#0F3BE8" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lumia-surface p-5 lg:col-span-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Pipeline</div>
          <h3 className="text-lg font-bold tracking-tight">Project status</h3>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.status_breakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {stats.status_breakdown.map((_, i) => <Cell key={i} fill={KPI_COLORS[i % KPI_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0F172A", border: "none", color: "#fff", fontSize: 12 }} formatter={(v, n) => [`${v}`, statusLabel(n)]} />
                <Legend formatter={legendFormatter} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low stock */}
      <div className="lumia-surface" data-testid="low-stock-section">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Warning size={20} weight="fill" color="#FF4B00" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">Inventory · Alerts</div>
              <h3 className="text-lg font-bold tracking-tight">Low stock items <span className="text-[#FF4B00] font-mono-num">({stats.low_stock_count})</span></h3>
            </div>
          </div>
          <Package size={20} weight="bold" color="#64748B" />
        </div>
        {stats.low_stock_items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">All materials above minimum stock. Good signal.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="text-left px-5 py-2 font-semibold">Code</th>
              <th className="text-left px-5 py-2 font-semibold">Material</th>
              <th className="text-left px-5 py-2 font-semibold">Category</th>
              <th className="text-right px-5 py-2 font-semibold">Stock</th>
              <th className="text-right px-5 py-2 font-semibold">Min Stock</th>
              <th className="text-left px-5 py-2 font-semibold">Status</th>
            </tr></thead>
            <tbody>
              {stats.low_stock_items.map((m) => (
                <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`low-stock-row-${m.id}`}>
                  <td className="px-5 py-3 font-mono-num text-slate-700">{m.code}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{m.name}</td>
                  <td className="px-5 py-3 text-slate-600">{m.category}</td>
                  <td className="px-5 py-3 text-right font-mono-num text-[#DC2626] font-semibold">{m.stock_qty} {m.unit}</td>
                  <td className="px-5 py-3 text-right font-mono-num text-slate-500">{m.min_stock} {m.unit}</td>
                  <td className="px-5 py-3"><span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border bg-red-50 text-red-800 border-red-300">Reorder</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
