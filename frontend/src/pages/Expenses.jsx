import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Modal, Field, Input, Select, Textarea, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, Trash, Receipt } from "@phosphor-icons/react";
import { toast } from "sonner";

const empty = { date: new Date().toISOString().slice(0,10), category: "Rent", payee: "", amount: 0, gst_pct: 0, mode: "cash", project_id: "", note: "" };

export default function Expenses() {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const [e, c, p] = await Promise.all([
      api.get("/expenses"),
      api.get("/expense-categories"),
      api.get("/projects").catch(() => ({ data: [] })),
    ]);
    setList(e.data); setCats(c.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm({ ...empty, category: cats[0] || "Rent" }); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/expenses", { ...form, amount: Number(form.amount) || 0, gst_pct: Number(form.gst_pct) || 0, project_id: form.project_id || null });
      toast.success("Expense recorded"); setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };
  const remove = async (id) => { if (!window.confirm("Delete expense?")) return; await api.delete(`/expenses/${id}`); load(); };

  const total = list.reduce((s, e) => s + e.total, 0);
  const byCat = {};
  list.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.total; });

  return (
    <div className="p-6 lg:p-8" data-testid="expenses-page">
      <PageHeader subtitle="Vyapar" title="Expenses"
        action={<Btn onClick={openCreate} data-testid="expense-create-btn"><Plus size={14} weight="bold" /> New Expense</Btn>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="lumia-surface p-4 col-span-2 md:col-span-1"><div className="text-[10px] uppercase font-bold text-slate-500">Total Expenses</div><div className="text-2xl font-black font-mono-num text-red-700">{fmtINR(total)}</div></div>
        {Object.entries(byCat).slice(0,3).map(([c, v]) => (
          <div key={c} className="lumia-surface p-4"><div className="text-[10px] uppercase font-bold text-slate-500 truncate">{c}</div><div className="text-xl font-black font-mono-num">{fmtINR(v)}</div></div>
        ))}
      </div>

      <div className="lumia-surface overflow-x-auto">
        {list.length === 0 ? <Empty title="No expenses recorded" note="Track rent, salaries, utilities, transport etc." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold">Exp #</th>
              <th className="text-left px-3 py-2 font-semibold">Date</th>
              <th className="text-left px-3 py-2 font-semibold">Category</th>
              <th className="text-left px-3 py-2 font-semibold">Payee</th>
              <th className="text-right px-3 py-2 font-semibold">Amount</th>
              <th className="text-right px-3 py-2 font-semibold">GST</th>
              <th className="text-right px-3 py-2 font-semibold">Total</th>
              <th className="text-left px-3 py-2 font-semibold">Mode</th>
              <th className="text-right px-3 py-2 font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`expense-row-${e.id}`}>
                  <td className="px-3 py-3 font-mono-num font-semibold">{e.expense_no}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{e.date?.slice(0,10)}</td>
                  <td className="px-3 py-3"><span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-700 border-slate-300">{e.category}</span></td>
                  <td className="px-3 py-3">{e.payee}</td>
                  <td className="px-3 py-3 text-right font-mono-num">{fmtINR(e.amount)}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-xs">{e.gst_pct}% / {fmtINR(e.gst_amount)}</td>
                  <td className="px-3 py-3 text-right font-mono-num font-bold text-red-700">{fmtINR(e.total)}</td>
                  <td className="px-3 py-3 uppercase text-[10px] font-bold">{e.mode}</td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => remove(e.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Expense" testid="expense-modal">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Category *">
              <Select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="expense-input-category">
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Payee"><Input value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} data-testid="expense-input-payee" /></Field>
            <Field label="Amount *"><Input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="expense-input-amount" /></Field>
            <Field label="GST %"><Input type="number" value={form.gst_pct} onChange={(e) => setForm({ ...form, gst_pct: e.target.value })} /></Field>
            <Field label="Mode">
              <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option><option value="cheque">Cheque</option>
              </Select>
            </Field>
            <Field label="Project (optional)">
              <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Note"><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" type="submit" data-testid="expense-submit-btn">Record</Btn></div>
        </form>
      </Modal>
    </div>
  );
}
