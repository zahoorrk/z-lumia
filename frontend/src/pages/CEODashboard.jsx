import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Crown, TrendUp, TrendDown, CurrencyInr, Package, Users, Trophy, ShieldCheck, ChartBar } from "@phosphor-icons/react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function Tile({ label, value, sub, accent = "#0F3BE8", Icon, testid }) {
  return (
    <div className="lumia-surface p-5 relative overflow-hidden" data-testid={testid}>
      <div className="absolute top-0 left-0 w-1 h-full" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">{label}</div>
        {Icon && <Icon size={16} weight="bold" style={{ color: accent }} />}
      </div>
      <div className="mt-2 text-2xl xl:text-3xl font-black tracking-tighter font-mono-num">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function HealthBar({ score }) {
  let color = "#16A34A";
  if (score < 50) color = "#DC2626";
  else if (score < 75) color = "#EAB308";
  return (
    <div className="lumia-surface p-5" data-testid="business-health">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">Business Health</div>
          <div className="text-3xl font-black font-mono-num" style={{ color }}>{score} / 100</div>
        </div>
        <ShieldCheck size={32} weight="fill" style={{ color }} />
      </div>
      <div className="h-3 bg-slate-100 overflow-hidden">
        <div className="h-3 transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="grid grid-cols-3 mt-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        <span className="text-red-700">Critical &lt; 50</span>
        <span className="text-center text-amber-700">Watch 50-75</span>
        <span className="text-right text-emerald-700">Healthy 75+</span>
      </div>
    </div>
  );
}

export default function CEODashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/ceo/dashboard").then((r) => setD(r.data)); }, []);

  if (!d) return <div className="p-6 text-sm text-slate-500">Loading CEO dashboard…</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="ceo-dashboard">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#FF4B00]">Executive View</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <Crown size={28} weight="fill" className="text-[#FF4B00]" /> CEO Cockpit
          </h1>
        </div>
        <div className="text-xs text-slate-500">{new Date().toLocaleString("en-IN")}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tile testid="ceo-revenue" label="Revenue" value={fmtINR(d.revenue)} sub="Completed projects" accent="#0F3BE8" Icon={CurrencyInr} />
          <Tile testid="ceo-profit" label="Profit" value={fmtINR(d.profit)} sub={`${d.profit_pct}% margin`} accent="#16A34A" Icon={TrendUp} />
          <Tile testid="ceo-outstanding" label="Outstanding" value={fmtINR(d.outstanding)} sub="To collect" accent="#DC2626" Icon={TrendDown} />
          <Tile testid="ceo-inventory" label="Inventory" value={fmtINR(d.inventory_value)} sub="Stock value" accent="#7C3AED" Icon={Package} />
          <Tile label="Collection Eff." value={`${d.collection_efficiency}%`} sub="Collected / Invoiced" accent="#0284C7" />
          <Tile label="In Production" value={d.in_production} sub="Active jobs" accent="#FF4B00" />
          <Tile label="In Installation" value={d.in_installation} sub="On site" accent="#FB923C" />
          <Tile label="Avg Margin" value={`${d.avg_project_margin_pct}%`} sub="Across projects" accent="#16A34A" />
        </div>
        <HealthBar score={d.business_health_score} />
      </div>

      {/* Growth & Insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile testid="ceo-rev-growth" label="Revenue Growth" value={`${d.revenue_growth_pct >= 0 ? "+" : ""}${d.revenue_growth_pct}%`} sub="MoM" accent={d.revenue_growth_pct >= 0 ? "#16A34A" : "#DC2626"} />
        <Tile testid="ceo-profit-growth" label="Profit Growth" value={`${d.profit_growth_pct >= 0 ? "+" : ""}${d.profit_growth_pct}%`} sub="MoM" accent={d.profit_growth_pct >= 0 ? "#16A34A" : "#DC2626"} />
        <Tile label="Payable to Vendors" value={fmtINR(d.outstanding_payable)} sub="Credit POs" accent="#DC2626" />
        <Tile label="Pending Projects" value={d.pending_projects} sub="Not closed" accent="#0F3BE8" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lumia-surface p-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Trend</div>
          <h3 className="text-lg font-bold tracking-tight">Monthly Revenue</h3>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.monthly}>
                <defs><linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0F3BE8" stopOpacity={0.35} /><stop offset="100%" stopColor="#0F3BE8" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#0F172A", border: "none", color: "#fff", fontSize: 12 }} formatter={(v) => fmtINR(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#0F3BE8" strokeWidth={2} fill="url(#rev2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lumia-surface p-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Trend</div>
          <h3 className="text-lg font-bold tracking-tight">Monthly Profit</h3>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.monthly}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#0F172A", border: "none", color: "#fff", fontSize: 12 }} formatter={(v) => fmtINR(v)} />
                <Bar dataKey="profit" fill="#16A34A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lumia-surface" data-testid="top-profitable">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200">
            <Trophy size={18} weight="fill" className="text-[#16A34A]" />
            <div><div className="text-[10px] uppercase font-bold text-slate-500">Top 10</div><h3 className="font-bold">Most Profitable Projects</h3></div>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="text-left px-3 py-2">Project</th><th className="text-left px-3 py-2">Client</th><th className="text-right px-3 py-2">Profit</th><th className="text-right px-3 py-2">Margin</th></tr></thead>
            <tbody>
              {d.top_profitable.map((p) => (
                <tr key={p.project_id} className="border-t border-slate-200">
                  <td className="px-3 py-2"><div className="font-mono-num text-[10px] text-slate-500">{p.project_no}</div><div className="font-semibold">{p.name}</div></td>
                  <td className="px-3 py-2">{p.client_name}</td>
                  <td className="px-3 py-2 text-right font-mono-num font-bold text-emerald-700">{fmtINR(p.profit)}</td>
                  <td className="px-3 py-2 text-right font-mono-num">{p.margin_pct}%</td>
                </tr>
              ))}
              {d.top_profitable.length === 0 && <tr><td className="px-3 py-4 text-slate-400 text-center" colSpan={4}>No data</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="lumia-surface" data-testid="top-loss">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200">
            <TrendDown size={18} weight="fill" className="text-[#DC2626]" />
            <div><div className="text-[10px] uppercase font-bold text-slate-500">Top 10</div><h3 className="font-bold">Loss-Making Projects</h3></div>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="text-left px-3 py-2">Project</th><th className="text-left px-3 py-2">Client</th><th className="text-right px-3 py-2">Profit</th><th className="text-right px-3 py-2">Margin</th></tr></thead>
            <tbody>
              {d.top_loss.map((p) => (
                <tr key={p.project_id} className="border-t border-slate-200">
                  <td className="px-3 py-2"><div className="font-mono-num text-[10px] text-slate-500">{p.project_no}</div><div className="font-semibold">{p.name}</div></td>
                  <td className="px-3 py-2">{p.client_name}</td>
                  <td className={`px-3 py-2 text-right font-mono-num font-bold ${p.profit >= 0 ? "text-slate-700" : "text-red-700"}`}>{fmtINR(p.profit)}</td>
                  <td className={`px-3 py-2 text-right font-mono-num ${p.margin_pct < 20 ? "text-red-700" : ""}`}>{p.margin_pct}%</td>
                </tr>
              ))}
              {d.top_loss.length === 0 && <tr><td className="px-3 py-4 text-slate-400 text-center" colSpan={4}>No data</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="lumia-surface" data-testid="top-clients">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200">
            <Users size={18} weight="bold" className="text-[#0F3BE8]" />
            <div><div className="text-[10px] uppercase font-bold text-slate-500">Revenue Concentration</div><h3 className="font-bold">Top Clients</h3></div>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="text-left px-3 py-2">Client</th><th className="text-right px-3 py-2">Projects</th><th className="text-right px-3 py-2">Revenue</th><th className="text-right px-3 py-2">Profit</th></tr></thead>
            <tbody>
              {d.top_clients.map((c) => (
                <tr key={c.client_name} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-semibold">{c.client_name}</td>
                  <td className="px-3 py-2 text-right font-mono-num">{c.projects}</td>
                  <td className="px-3 py-2 text-right font-mono-num font-bold">{fmtINR(c.revenue)}</td>
                  <td className="px-3 py-2 text-right font-mono-num text-emerald-700">{fmtINR(c.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lumia-surface" data-testid="least-profitable-clients">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200">
            <ChartBar size={18} weight="bold" className="text-[#FF4B00]" />
            <div><div className="text-[10px] uppercase font-bold text-slate-500">Margin Watch</div><h3 className="font-bold">Least Profitable Clients</h3></div>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="text-left px-3 py-2">Client</th><th className="text-right px-3 py-2">Revenue</th><th className="text-right px-3 py-2">Margin</th></tr></thead>
            <tbody>
              {d.least_profitable_clients.map((c) => (
                <tr key={c.client_name} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-semibold">{c.client_name}</td>
                  <td className="px-3 py-2 text-right font-mono-num">{fmtINR(c.revenue)}</td>
                  <td className={`px-3 py-2 text-right font-mono-num font-bold ${c.margin_pct < 20 ? "text-red-700" : c.margin_pct < 30 ? "text-amber-700" : "text-emerald-700"}`}>{c.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
