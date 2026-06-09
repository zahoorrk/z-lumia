import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, CheckCircle, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Purchases() {
  const [list, setList] = useState([]);
  const [mats, setMats] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ vendor: "", material_id: "", material_name: "", qty: 1, unit_price: 0, status: "ordered" });

  const load = async () => {
    const [p, m] = await Promise.all([api.get("/purchases"), api.get("/materials")]);
    setList(p.data); setMats(m.data);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm({ vendor: "", material_id: mats[0]?.id || "", material_name: "", qty: 1, unit_price: 0, status: "ordered" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, qty: Number(form.qty), unit_price: Number(form.unit_price) };
      await api.post("/purchases", payload);
      toast.success("Purchase order created");
      setOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  const receive = async (id) => {
    await api.put(`/purchases/${id}/receive`);
    toast.success("Marked as received & stock updated");
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete PO?")) return;
    await api.delete(`/purchases/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-8" data-testid="purchases-page">
      <PageHeader
        subtitle="Procurement"
        title="Purchase Orders"
        action={<Btn onClick={openCreate} data-testid="po-create-btn"><Plus size={14} weight="bold" /> New PO</Btn>}
      />

      <div className="lumia-surface overflow-x-auto">
        {list.length === 0 ? (
          <Empty title="No purchase orders yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">PO #</th>
                <th className="text-left px-4 py-2 font-semibold">Vendor</th>
                <th className="text-left px-4 py-2 font-semibold">Material</th>
                <th className="text-right px-4 py-2 font-semibold">Qty</th>
                <th className="text-right px-4 py-2 font-semibold">Unit Price</th>
                <th className="text-right px-4 py-2 font-semibold">Total</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-right px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`po-row-${p.id}`}>
                  <td className="px-4 py-3 font-mono-num font-semibold">{p.po_no}</td>
                  <td className="px-4 py-3">{p.vendor}</td>
                  <td className="px-4 py-3">{p.material_name}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{p.qty}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{fmtINR(p.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold">{fmtINR(p.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "ordered" && (
                      <button onClick={() => receive(p.id)} className="text-emerald-600 hover:text-emerald-800 p-1.5" data-testid={`po-receive-${p.id}`} title="Mark received">
                        <CheckCircle size={18} weight="bold" />
                      </button>
                    )}
                    <button onClick={() => remove(p.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase Order" testid="po-modal">
        <form onSubmit={save} className="space-y-4">
          <Field label="Vendor *"><Input required value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} data-testid="po-input-vendor" /></Field>
          <Field label="Material">
            <Select value={form.material_id} onChange={(e) => {
              const m = mats.find((x) => x.id === e.target.value);
              setForm({ ...form, material_id: e.target.value, material_name: m?.name || "", unit_price: m?.unit_cost || form.unit_price });
            }} data-testid="po-input-material">
              <option value="">— Free-text material —</option>
              {mats.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
            </Select>
          </Field>
          {!form.material_id && (
            <Field label="Material Name (free text)"><Input value={form.material_name} onChange={(e) => setForm({ ...form, material_name: e.target.value })} /></Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty *"><Input required type="number" min="0.01" step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
            <Field label="Unit Price (₹) *"><Input required type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></Field>
          </div>
          <div className="text-right text-sm">
            <span className="text-slate-500 mr-2">Total:</span>
            <span className="font-mono-num text-xl font-black text-[#0F3BE8]">{fmtINR((Number(form.qty) || 0) * (Number(form.unit_price) || 0))}</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="po-submit-btn">Create PO</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
