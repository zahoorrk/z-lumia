import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Modal, Field, Input, Select, Textarea, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, PencilSimple, Trash, BookOpen, Users } from "@phosphor-icons/react";
import { toast } from "sonner";

const KINDS = [
  { v: "customer", l: "Customer" },
  { v: "supplier", l: "Supplier" },
  { v: "both", l: "Both" },
];

const emptyForm = { name: "", kind: "customer", phone: "", email: "", gstin: "", state: "Maharashtra", address: "", opening_balance: 0, opening_balance_date: "", notes: "" };

export default function Parties() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledger, setLedger] = useState(null);

  const load = () => api.get("/parties").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...emptyForm, ...p, opening_balance_date: p.opening_balance_date?.slice(0,10) || "" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, opening_balance: Number(form.opening_balance) || 0 };
      if (editing) await api.put(`/parties/${editing.id}`, payload);
      else await api.post("/parties", payload);
      toast.success(editing ? "Party updated" : "Party created");
      setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  const remove = async (id) => { if (!window.confirm("Delete party?")) return; await api.delete(`/parties/${id}`); load(); };

  const openLedger = async (p) => {
    const { data } = await api.get(`/parties/${p.id}/ledger`);
    setLedger(data); setLedgerOpen(true);
  };

  const filtered = list.filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || (p.phone || "").includes(filter));

  return (
    <div className="p-6 lg:p-8" data-testid="parties-page">
      <PageHeader
        subtitle="Vyapar-style Billing"
        title="Parties · Ledger"
        action={<Btn onClick={openCreate} data-testid="party-create-btn"><Plus size={14} weight="bold" /> New Party</Btn>}
      />

      <div className="mb-4">
        <Input placeholder="Search by name or phone…" value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-72" data-testid="party-search" />
      </div>

      <div className="lumia-surface overflow-x-auto">
        {filtered.length === 0 ? <Empty title="No parties yet" note="Add customers/suppliers to track their running balance." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold">Name</th>
              <th className="text-left px-3 py-2 font-semibold">Type</th>
              <th className="text-left px-3 py-2 font-semibold">Contact</th>
              <th className="text-left px-3 py-2 font-semibold">GSTIN</th>
              <th className="text-right px-3 py-2 font-semibold">Opening</th>
              <th className="text-right px-3 py-2 font-semibold">Receivable</th>
              <th className="text-right px-3 py-2 font-semibold">Payable</th>
              <th className="text-right px-3 py-2 font-semibold">Net</th>
              <th className="text-right px-3 py-2 font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`party-row-${p.id}`}>
                  <td className="px-3 py-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-3 py-3"><span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-700 border-slate-300">{p.kind}</span></td>
                  <td className="px-3 py-3 text-xs text-slate-600 font-mono-num">{p.phone}<div className="text-slate-400">{p.email}</div></td>
                  <td className="px-3 py-3 text-xs font-mono-num text-slate-600">{p.gstin}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-slate-500">{fmtINR(p.opening_balance)}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-emerald-700">{fmtINR(p.receivable)}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-red-700">{fmtINR(p.payable)}</td>
                  <td className={`px-3 py-3 text-right font-mono-num font-bold ${p.net_balance >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtINR(p.net_balance)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openLedger(p)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5" title="Ledger" data-testid={`party-ledger-${p.id}`}><BookOpen size={16} weight="bold" /></button>
                    <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5"><PencilSimple size={16} weight="bold" /></button>
                    <button onClick={() => remove(p.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Party" : "New Party"} testid="party-modal">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="party-input-name" /></Field>
            <Field label="Type">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
              </Select>
            </Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="party-input-phone" /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Field>
            <Field label="State"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
            <Field label="Opening Balance (₹)"><Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></Field>
            <Field label="Opening Date"><Input type="date" value={form.opening_balance_date} onChange={(e) => setForm({ ...form, opening_balance_date: e.target.value })} /></Field>
          </div>
          <Field label="Address"><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="party-submit-btn">{editing ? "Update" : "Create"}</Btn>
          </div>
        </form>
      </Modal>

      <Modal open={ledgerOpen} onClose={() => setLedgerOpen(false)} title={ledger ? `Ledger · ${ledger.party.name}` : "Ledger"} testid="party-ledger-modal">
        {ledger && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-slate-300 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Opening</div><div className="font-mono-num font-bold">{fmtINR(ledger.opening_balance)}</div></div>
              <div className="border border-slate-300 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Debit (To Receive)</div><div className="font-mono-num font-bold text-emerald-700">{fmtINR(ledger.total_debit)}</div></div>
              <div className="border border-slate-300 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Credit (To Pay)</div><div className="font-mono-num font-bold text-red-700">{fmtINR(ledger.total_credit)}</div></div>
              <div className="border border-slate-300 p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Closing</div><div className={`font-mono-num text-xl font-black ${ledger.closing_balance >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtINR(ledger.closing_balance)}</div></div>
            </div>
            <div className="lumia-surface overflow-x-auto max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Kind</th><th className="text-left px-3 py-2">Ref</th><th className="text-left px-3 py-2">Description</th><th className="text-right px-3 py-2">Debit</th><th className="text-right px-3 py-2">Credit</th><th className="text-right px-3 py-2">Running</th></tr>
                </thead>
                <tbody>
                  {ledger.entries.map((e, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-3 py-2 text-slate-500">{(e.date || "").slice(0,10)}</td>
                      <td className="px-3 py-2 uppercase text-[10px] font-bold">{e.kind}</td>
                      <td className="px-3 py-2 font-mono-num">{e.ref}</td>
                      <td className="px-3 py-2">{e.desc}</td>
                      <td className="px-3 py-2 text-right font-mono-num text-emerald-700">{e.debit ? fmtINR(e.debit) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono-num text-red-700">{e.credit ? fmtINR(e.credit) : "—"}</td>
                      <td className={`px-3 py-2 text-right font-mono-num font-bold ${e.running_balance >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtINR(e.running_balance)}</td>
                    </tr>
                  ))}
                  {ledger.entries.length === 0 && <tr><td className="px-3 py-4 text-center text-slate-400" colSpan={7}>No transactions yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
