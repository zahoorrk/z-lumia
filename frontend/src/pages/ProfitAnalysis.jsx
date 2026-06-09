import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { PageHeader, StatusBadge, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function ProfitAnalysis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/profit-analysis").then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(
    () => rows.slice(0, 8).map((r) => ({ name: r.project_no, revenue: r.revenue, cost: r.total_cost, profit: r.profit })),
    [rows]
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        cost: acc.cost + r.total_cost,
        profit: acc.profit + r.profit,
      }),
      { revenue: 0, cost: 0, profit: 0 }
    );
  }, [rows]);

  return (
    <div className="p-6 lg:p-8" data-testid="profit-page">
      <PageHeader subtitle="Financials" title="Profit Analysis" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="lumia-surface p-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Revenue</div>
          <div className="text-3xl font-black font-mono-num text-[#0F3BE8]">{fmtINR(totals.revenue)}</div>
        </div>
        <div className="lumia-surface p-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Cost</div>
          <div className="text-3xl font-black font-mono-num text-[#FF4B00]">{fmtINR(totals.cost)}</div>
        </div>
        <div className="lumia-surface p-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Profit</div>
          <div className={`text-3xl font-black font-mono-num ${totals.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtINR(totals.profit)}</div>
        </div>
      </div>

      <div className="lumia-surface p-5 mb-6">
        <h3 className="text-lg font-bold tracking-tight mb-4">Project comparison</h3>
        <div className="h-72">
          {chartData.length === 0 ? (
            <Empty title="No data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#0F172A", border: "none", color: "#fff", fontSize: 12 }} formatter={(v) => fmtINR(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#0F3BE8" name="Revenue" />
                <Bar dataKey="cost" fill="#FF4B00" name="Cost" />
                <Bar dataKey="profit" fill="#16A34A" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="lumia-surface overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <Empty title="No profit data" note="Add costs and projects first." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">Project #</th>
                <th className="text-left px-4 py-2 font-semibold">Name</th>
                <th className="text-left px-4 py-2 font-semibold">Client</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-right px-4 py-2 font-semibold">Revenue</th>
                <th className="text-right px-4 py-2 font-semibold">Cost</th>
                <th className="text-right px-4 py-2 font-semibold">Profit</th>
                <th className="text-right px-4 py-2 font-semibold">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.project_id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`profit-row-${r.project_id}`}>
                  <td className="px-4 py-3 font-mono-num font-semibold">{r.project_no}</td>
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3">{r.client_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right font-mono-num">{fmtINR(r.revenue)}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{fmtINR(r.total_cost)}</td>
                  <td className={`px-4 py-3 text-right font-mono-num font-bold ${r.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtINR(r.profit)}</td>
                  <td className={`px-4 py-3 text-right font-mono-num ${r.margin_pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>{r.margin_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
