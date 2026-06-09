import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { DownloadSimple } from "@phosphor-icons/react";

function exportToCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [profit, setProfit] = useState([]);

  useEffect(() => {
    api.get("/reports/summary").then((r) => setSummary(r.data));
    api.get("/profit-analysis").then((r) => setProfit(r.data));
  }, []);

  if (!summary) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  const tiles = [
    { label: "Total Revenue", value: fmtINR(summary.total_revenue), accent: "#0F3BE8" },
    { label: "Total Cost", value: fmtINR(summary.total_cost), accent: "#FF4B00" },
    { label: "Total Profit", value: fmtINR(summary.total_profit), accent: "#16A34A" },
    { label: "Margin", value: `${summary.margin_pct}%`, accent: "#7C3AED" },
    { label: "Inventory Value", value: fmtINR(summary.inventory_value), accent: "#0284C7" },
    { label: "Projects", value: summary.projects_count, accent: "#0F172A" },
    { label: "Leads", value: summary.leads_count, accent: "#475569" },
    { label: "Won Leads", value: summary.won_leads, accent: "#16A34A" },
  ];

  return (
    <div className="p-6 lg:p-8" data-testid="reports-page">
      <PageHeader
        subtitle="Analytics"
        title="Reports"
        action={
          <Btn onClick={() => exportToCSV("profit_report.csv", profit)} data-testid="report-export-btn">
            <DownloadSimple size={14} weight="bold" /> Export Profit CSV
          </Btn>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {tiles.map((t) => (
          <div key={t.label} className="lumia-surface p-4 relative">
            <div className="absolute top-0 left-0 w-1 h-full" style={{ background: t.accent }} />
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t.label}</div>
            <div className="text-2xl font-black font-mono-num">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="lumia-surface p-5">
        <h3 className="text-lg font-bold tracking-tight mb-2">Notes on this report</h3>
        <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
          <li>Revenue counts only <b>completed</b> projects.</li>
          <li>Profit = Contract Value − (Material + Labour + Transport + Machine + Overhead).</li>
          <li>Inventory value = stock_qty × unit_cost across material master.</li>
          <li>Export creates a CSV for project-wise profit analysis.</li>
        </ul>
      </div>
    </div>
  );
}
