import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

const STATUSES = ["draft", "sent", "approved", "rejected"];
const emptyItem = { description: "", qty: 1, unit_price: 0 };

export default function Quotations() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ client_name: "", lead_id: "", tax_pct: 18, status: "draft", items: [{ ...emptyItem }] });

  const load = () => {
    setLoading(true);
    api.get("/quotations").then((r) => setList(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ client_name: "", lead_id: "", tax_pct: 18, status: "draft", items: [{ ...emptyItem }] });
    setOpen(true);
  };
  const openEdit = (q) => {
    setEditing(q);
    setForm({
      client_name: q.client_name,
      lead_id: q.lead_id || "",
      tax_pct: q.tax_pct,
      status: q.status,
      items: q.items?.length ? q.items : [{ ...emptyItem }],
    });
    setOpen(true);
  };

  const setItem = (i, k, v) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: k === "description" ? v : Number(v) || 0 };
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const rmItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const subtotal = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const total = subtotal * (1 + (Number(form.tax_pct) || 0) / 100);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, tax_pct: Number(form.tax_pct) || 0, items: form.items.filter((i) => i.description.trim()) };
      if (editing) await api.put(`/quotations/${editing.id}`, payload);
      else await api.post("/quotations", payload);
      toast.success(editing ? "Quotation updated" : "Quotation created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete quotation?")) return;
    await api.delete(`/quotations/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-8" data-testid="quotations-page">
      <PageHeader
        subtitle="Sales"
        title="Quotations"
        action={
          <Btn onClick={openCreate} data-testid="quote-create-btn">
            <Plus size={14} weight="bold" /> New Quotation
          </Btn>
        }
      />

      <div className="lumia-surface overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : list.length === 0 ? (
          <Empty title="No quotations yet" note="Create one from a lead." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">Quote #</th>
                <th className="text-left px-4 py-2 font-semibold">Client</th>
                <th className="text-right px-4 py-2 font-semibold">Items</th>
                <th className="text-right px-4 py-2 font-semibold">Subtotal</th>
                <th className="text-right px-4 py-2 font-semibold">Tax %</th>
                <th className="text-right px-4 py-2 font-semibold">Total</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-right px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((q) => (
                <tr key={q.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono-num font-semibold text-slate-900">{q.quote_no}</td>
                  <td className="px-4 py-3">{q.client_name}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{q.items?.length || 0}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{fmtINR(q.subtotal)}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{q.tax_pct}%</td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold">{fmtINR(q.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(q)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5"><PencilSimple size={16} weight="bold" /></button>
                    <button onClick={() => remove(q.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Quotation" : "New Quotation"} testid="quote-modal">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Client Name *">
              <Input data-testid="quote-input-client" required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Line items</span>
              <button type="button" onClick={addItem} className="text-xs text-[#0F3BE8] font-bold uppercase tracking-wider" data-testid="quote-add-item-btn">+ Add item</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-6" placeholder="Description" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} data-testid={`quote-item-desc-${i}`} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
                  <Input className="col-span-3" type="number" placeholder="Unit price" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} />
                  <button type="button" onClick={() => rmItem(i)} className="col-span-1 text-slate-400 hover:text-red-600"><Trash size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <Field label="Tax %">
              <Input type="number" value={form.tax_pct} onChange={(e) => setForm({ ...form, tax_pct: e.target.value })} />
            </Field>
            <div className="text-right col-span-2">
              <div className="text-xs text-slate-500">Subtotal</div>
              <div className="font-mono-num text-lg font-bold">{fmtINR(subtotal)}</div>
              <div className="text-xs text-slate-500 mt-2">Total (incl. tax)</div>
              <div className="font-mono-num text-2xl font-black text-[#0F3BE8]">{fmtINR(total)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="quote-submit-btn">{editing ? "Update" : "Create"}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
