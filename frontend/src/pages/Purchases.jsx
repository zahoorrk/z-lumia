import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, CheckCircle, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const empty = { supplier_id: "", supplier_name: "", material_id: "", material_name: "", qty: 1, rate: 0, gst_pct: 18, purchase_date: new Date().toISOString().slice(0,10), payment_terms: "cash" };

export default function Purchases() {
  const { user } = useAuth();
  const canApprove = ["admin", "accounts"].includes(user?.role);
  const canStore = ["admin", "store"].includes(user?.role);
  const [list, setList] = useState([]);
  const [mats, setMats] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const [p, m, s] = await Promise.all([api.get("/purchases"), api.get("/materials"), api.get("/suppliers")]);
    setList(p.data); setMats(m.data); setSuppliers(s.data);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...empty, supplier_id: suppliers[0]?.id || "" }); setOpen(true); };
  const openEdit = (po) => {
    setEditing(po);
    setForm({
      supplier_id: po.supplier_id || "", supplier_name: po.supplier_name,
      material_id: po.material_id || "", material_name: po.material_name,
      qty: po.qty, rate: po.rate, gst_pct: po.gst_pct,
      purchase_date: po.purchase_date?.slice(0,10) || "",
      payment_terms: po.payment_terms,
    });
    setOpen(true);
  };

  const subtotal = (Number(form.qty) || 0) * (Number(form.rate) || 0);
  const gstAmt = subtotal * (Number(form.gst_pct) || 0) / 100;
  const total = subtotal + gstAmt;

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        qty: Number(form.qty), rate: Number(form.rate), gst_pct: Number(form.gst_pct),
        supplier_id: form.supplier_id || null, material_id: form.material_id || null,
      };
      if (editing) await api.put(`/purchases/${editing.id}`, payload);
      else await api.post("/purchases", payload);
      toast.success(editing ? "PO updated" : "PO created");
      setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  const approve = async (id) => { await api.post(`/purchases/${id}/approve`); toast.success("PO approved"); load(); };
  const receive = async (id) => { await api.post(`/purchases/${id}/receive`); toast.success("Stock updated"); load(); };
  const remove = async (id) => { if (!window.confirm("Delete PO?")) return; await api.delete(`/purchases/${id}`); load(); };

  return (
    <div className="p-6 lg:p-8" data-testid="purchases-page">
      <PageHeader
        subtitle="Procurement"
        title="Purchase Orders"
        action={canStore && <Btn onClick={openCreate} data-testid="po-create-btn"><Plus size={14} weight="bold" /> New PO</Btn>}
      />

      <div className="lumia-surface overflow-x-auto">
        {list.length === 0 ? <Empty title="No purchase orders yet" /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold">PO #</th>
              <th className="text-left px-3 py-2 font-semibold">Date</th>
              <th className="text-left px-3 py-2 font-semibold">Supplier</th>
              <th className="text-left px-3 py-2 font-semibold">Material</th>
              <th className="text-right px-3 py-2 font-semibold">Qty</th>
              <th className="text-right px-3 py-2 font-semibold">Rate</th>
              <th className="text-right px-3 py-2 font-semibold">GST</th>
              <th className="text-right px-3 py-2 font-semibold">Total</th>
              <th className="text-left px-3 py-2 font-semibold">Terms</th>
              <th className="text-left px-3 py-2 font-semibold">Pay</th>
              <th className="text-left px-3 py-2 font-semibold">Status</th>
              <th className="text-right px-3 py-2 font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`po-row-${p.id}`}>
                  <td className="px-3 py-3 font-mono-num font-semibold">{p.po_no}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{p.purchase_date?.slice(0,10)}</td>
                  <td className="px-3 py-3">{p.supplier_name}</td>
                  <td className="px-3 py-3">{p.material_name}</td>
                  <td className="px-3 py-3 text-right font-mono-num">{p.qty}</td>
                  <td className="px-3 py-3 text-right font-mono-num">{fmtINR(p.rate)}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-xs">{p.gst_pct}% / {fmtINR(p.gst_amount)}</td>
                  <td className="px-3 py-3 text-right font-mono-num font-bold">{fmtINR(p.total)}</td>
                  <td className="px-3 py-3"><StatusBadge status={p.payment_terms} /></td>
                  <td className="px-3 py-3">
                    <StatusBadge status={p.payment_status} />
                    {p.payment_terms === "credit" && p.payment_status !== "paid" && (
                      <div className="text-[10px] text-red-600 mt-1 font-mono-num">Due {fmtINR(p.total - p.paid_amount)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {p.status === "pending" && canApprove && (
                      <button onClick={() => approve(p.id)} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100" data-testid={`po-approve-${p.id}`}>Approve</button>
                    )}
                    {p.status === "approved" && canStore && (
                      <button onClick={() => receive(p.id)} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ml-1" data-testid={`po-receive-${p.id}`}>Receive</button>
                    )}
                    {p.status !== "received" && canStore && (
                      <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5"><PencilSimple size={16} weight="bold" /></button>
                    )}
                    {canStore && <button onClick={() => remove(p.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit PO" : "New Purchase Order"} testid="po-modal">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supplier *">
              <Select required value={form.supplier_id} onChange={(e) => { const s = suppliers.find((x) => x.id === e.target.value); setForm({ ...form, supplier_id: e.target.value, supplier_name: s?.name || "" }); }} data-testid="po-input-supplier">
                <option value="">— Select —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Purchase Date"><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
          </div>
          <Field label="Material">
            <Select value={form.material_id} onChange={(e) => { const m = mats.find((x) => x.id === e.target.value); setForm({ ...form, material_id: e.target.value, material_name: m?.name || form.material_name, rate: m?.purchase_rate || form.rate }); }} data-testid="po-input-material">
              <option value="">— Free-text —</option>
              {mats.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
            </Select>
          </Field>
          {!form.material_id && (
            <Field label="Material Name (free text)"><Input value={form.material_name} onChange={(e) => setForm({ ...form, material_name: e.target.value })} /></Field>
          )}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Quantity *"><Input required type="number" min="0.01" step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
            <Field label="Rate (₹) *"><Input required type="number" min="0" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
            <Field label="GST %"><Input type="number" min="0" step="0.01" value={form.gst_pct} onChange={(e) => setForm({ ...form, gst_pct: e.target.value })} /></Field>
          </div>
          <Field label="Payment Terms">
            <Select value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} data-testid="po-input-terms">
              <option value="cash">Cash (Paid on creation)</option>
              <option value="credit">Credit (Pay later)</option>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-4 text-right text-sm bg-slate-50 p-3 border border-slate-200">
            <div><div className="text-[10px] uppercase text-slate-500">Subtotal</div><div className="font-mono-num font-bold">{fmtINR(subtotal)}</div></div>
            <div><div className="text-[10px] uppercase text-slate-500">GST</div><div className="font-mono-num font-bold">{fmtINR(gstAmt)}</div></div>
            <div><div className="text-[10px] uppercase text-slate-500">Total</div><div className="font-mono-num text-xl font-black text-[#0F3BE8]">{fmtINR(total)}</div></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="po-submit-btn">{editing ? "Update" : "Create PO"}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
