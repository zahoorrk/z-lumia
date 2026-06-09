import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Empty } from "@/components/Bits";
import { Download } from "@phosphor-icons/react";
import { fmtINR } from "@/lib/constants";

const REPORTS = [
  { kind: "revenue", title: "Revenue Report", sub: "Per-project revenue, cost & profit" },
  { kind: "gst", title: "GST Report", sub: "All invoices with CGST/SGST/IGST" },
  { kind: "inventory", title: "Inventory Report", sub: "Material master with stock value" },
  { kind: "purchases", title: "Purchase Report", sub: "All POs with payment status" },
  { kind: "outstanding", title: "Outstanding Report", sub: "Unpaid invoices only" },
  { kind: "clients", title: "Client Report", sub: "Per-client aggregated revenue & profit" },
];

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [gst, setGst] = useState(null);

  useEffect(() => {
    api.get("/reports/summary").then((r) => setSummary(r.data));
    api.get("/gst/summary").then((r) => setGst(r.data));
  }, []);

  const exportCSV = async (kind) => {
    const { data } = await api.get("/reports/export", { params: { kind } });
    const blob = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lumiasign_${kind}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="reports-page">
      <PageHeader subtitle="Analytics" title="Reports Center" />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="lumia-surface p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Revenue</div><div className="text-2xl font-black font-mono-num">{fmtINR(summary.total_revenue)}</div></div>
          <div className="lumia-surface p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Profit</div><div className="text-2xl font-black font-mono-num text-emerald-700">{fmtINR(summary.total_profit)}</div></div>
          <div className="lumia-surface p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Margin</div><div className="text-2xl font-black font-mono-num">{summary.margin_pct}%</div></div>
          <div className="lumia-surface p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Outstanding Payable</div><div className="text-2xl font-black font-mono-num text-red-700">{fmtINR(summary.outstanding_payable)}</div></div>
        </div>
      )}

      {gst && (
        <div className="lumia-surface p-5" data-testid="gst-summary">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Compliance</div>
          <h3 className="text-lg font-bold tracking-tight mb-3">GST Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="border border-slate-200 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Output Subtotal</div><div className="font-mono-num font-bold">{fmtINR(gst.output_subtotal)}</div></div>
            <div className="border border-slate-200 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Output GST</div><div className="font-mono-num font-bold text-[#0F3BE8]">{fmtINR(gst.output_gst)}</div><div className="text-[10px] text-slate-500">CGST {fmtINR(gst.output_cgst)} · SGST {fmtINR(gst.output_sgst)} · IGST {fmtINR(gst.output_igst)}</div></div>
            <div className="border border-slate-200 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Input GST (ITC)</div><div className="font-mono-num font-bold">{fmtINR(gst.input_gst)}</div></div>
            <div className="border border-slate-200 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Net Payable</div><div className="font-mono-num text-xl font-black text-[#FF4B00]">{fmtINR(gst.net_payable)}</div></div>
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Export</div>
        <h3 className="text-lg font-bold tracking-tight mb-3">Download Reports (CSV)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORTS.map((r) => (
            <div key={r.kind} className="lumia-surface p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">{r.title}</div>
                <div className="text-xs text-slate-500">{r.sub}</div>
              </div>
              <Btn variant="ghost" onClick={() => exportCSV(r.kind)} data-testid={`export-${r.kind}`}><Download size={14} weight="bold" /> CSV</Btn>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
