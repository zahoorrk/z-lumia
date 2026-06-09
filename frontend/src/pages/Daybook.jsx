import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Empty, Input } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Bank, Money, ArrowDown, ArrowUp, CaretLeft, CaretRight } from "@phosphor-icons/react";

function KindBadge({ kind }) {
  const map = {
    sale: { c: "bg-blue-50 text-blue-800 border-blue-300", l: "Sale" },
    receipt: { c: "bg-emerald-50 text-emerald-800 border-emerald-300", l: "Receipt" },
    expense: { c: "bg-red-50 text-red-800 border-red-300", l: "Expense" },
    vendor_payment: { c: "bg-amber-50 text-amber-800 border-amber-300", l: "Vendor Pay" },
    purchase: { c: "bg-violet-50 text-violet-800 border-violet-300", l: "Purchase" },
  };
  const it = map[kind] || { c: "bg-slate-100 text-slate-700 border-slate-300", l: kind };
  return <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${it.c}`}>{it.l}</span>;
}

export default function Daybook() {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [data, setData] = useState(null);
  const [accts, setAccts] = useState([]);

  const load = () => {
    api.get("/daybook", { params: { date } }).then((r) => setData(r.data));
    api.get("/cash-accounts").then((r) => setAccts(r.data));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  const shift = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0,10));
  };

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="daybook-page">
      <PageHeader subtitle="Vyapar · Daily Cashbook" title="Daybook"
        action={
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={() => shift(-1)} data-testid="daybook-prev"><CaretLeft size={14} weight="bold" /> Prev</Btn>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="daybook-date" />
            <Btn variant="ghost" onClick={() => shift(1)} data-testid="daybook-next">Next <CaretRight size={14} weight="bold" /></Btn>
          </div>
        }
      />

      {/* Cash accounts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accts.map((a) => (
          <div key={a.id} className="lumia-surface p-4 relative" data-testid={`cash-acct-${a.id}`}>
            <div className="absolute top-0 left-0 w-1 h-full" style={{ background: a.kind === "cash" ? "#16A34A" : a.kind === "bank" ? "#0F3BE8" : "#7C3AED" }} />
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-bold text-slate-500">{a.name}</div>
              {a.kind === "bank" ? <Bank size={16} weight="bold" className="text-[#0F3BE8]" /> : <Money size={16} weight="bold" className="text-[#16A34A]" />}
            </div>
            <div className="mt-2 text-2xl font-black font-mono-num">{fmtINR(a.balance)}</div>
            <div className="text-xs text-slate-500 mt-1 flex gap-3">
              <span className="text-emerald-700">↓ {fmtINR(a.inflow)}</span>
              <span className="text-red-700">↑ {fmtINR(a.outflow)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Today summary */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="lumia-surface p-4 border-l-4 border-l-emerald-600">
            <div className="text-[10px] uppercase font-bold text-slate-500">Total In ({date})</div>
            <div className="text-3xl font-black font-mono-num text-emerald-700">{fmtINR(data.total_in)}</div>
          </div>
          <div className="lumia-surface p-4 border-l-4 border-l-red-600">
            <div className="text-[10px] uppercase font-bold text-slate-500">Total Out</div>
            <div className="text-3xl font-black font-mono-num text-red-700">{fmtINR(data.total_out)}</div>
          </div>
          <div className="lumia-surface p-4 border-l-4 border-l-blue-600">
            <div className="text-[10px] uppercase font-bold text-slate-500">Net</div>
            <div className={`text-3xl font-black font-mono-num ${data.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtINR(data.net)}</div>
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="lumia-surface overflow-x-auto">
        {!data ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : data.entries.length === 0 ? (
          <Empty title="No transactions" note={`No money movement on ${date}.`} />
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold">Time</th>
              <th className="text-left px-3 py-2 font-semibold">Type</th>
              <th className="text-left px-3 py-2 font-semibold">Ref</th>
              <th className="text-left px-3 py-2 font-semibold">Party</th>
              <th className="text-left px-3 py-2 font-semibold">Description</th>
              <th className="text-left px-3 py-2 font-semibold">Mode</th>
              <th className="text-right px-3 py-2 font-semibold">In</th>
              <th className="text-right px-3 py-2 font-semibold">Out</th>
            </tr></thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={i} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`daybook-entry-${i}`}>
                  <td className="px-3 py-3 text-xs text-slate-500">{(e.time || "").slice(11,16)}</td>
                  <td className="px-3 py-3"><KindBadge kind={e.kind} /></td>
                  <td className="px-3 py-3 font-mono-num text-xs font-semibold">{e.ref}</td>
                  <td className="px-3 py-3 text-slate-700">{e.party}</td>
                  <td className="px-3 py-3 text-slate-600 text-xs">{e.desc}</td>
                  <td className="px-3 py-3 uppercase text-[10px] font-bold text-slate-600">{e.mode}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-emerald-700 font-bold">{e.in ? fmtINR(e.in) : "—"}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-red-700 font-bold">{e.out ? fmtINR(e.out) : "—"}</td>
                </tr>
              ))}
            </tbody>
            {data.entries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white">
                  <td className="px-3 py-3 text-[10px] uppercase tracking-wider font-bold" colSpan={6}>TOTAL</td>
                  <td className="px-3 py-3 text-right font-mono-num font-bold">{fmtINR(data.total_in)}</td>
                  <td className="px-3 py-3 text-right font-mono-num font-bold">{fmtINR(data.total_out)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
