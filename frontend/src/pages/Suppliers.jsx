import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Modal, Field, Input, Textarea, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, PencilSimple, Trash, BookOpen } from "@phosphor-icons/react";
import { toast } from "sonner";

const emptyForm = { name: "", mobile: "", gst_number: "", address: "" };
const emptyPay = { supplier_id: "", purchase_id: "", amount: 0, method: "bank", note: "" };

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledger, setLedger] = useState(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState(emptyPay);
  const [unpaidPOs, setUnpaidPOs] = useState([]);

  const load = () => api.get("/suppliers").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, mobile: s.mobile || "", gst_number: s.gst_number || "", address: s.address || "" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post("/suppliers", form);
      toast.success(editing ? "Supplier updated" : "Supplier created");
      setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete supplier?")) return;
    await api.delete(`/suppliers/${id}`); load();
  };

  const openLedger = async (s) => {
    const { data } = await api.get(`/suppliers/${s.id}/ledger`);
    setLedger(data); setLedgerOpen(true);
  };

  const openPay = async (s) => {
    const { data } = await api.get(`/suppliers/${s.id}/ledger`);
    const unpaid = data.purchases.filter((p) => p.payment_status !== "paid");
    setUnpaidPOs(unpaid);
    setPayForm({ ...emptyPay, supplier_id: s.id, purchase_id: unpaid[0]?.id || "", amount: 0 });
    setPayOpen(true);
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post("/vendor-payments", { ...payForm, amount: Number(payForm.amount), purchase_id: payForm.purchase_id || null });
      toast.success("Payment recorded");
      setPayOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  return (
    <div className="p-6 lg:p-8" data-testid="suppliers-page">
      <PageHeader
        subtitle="Procurement"
        title="Suppliers / Vendors"
        action={<Btn onClick={openCreate} data-testid="supplier-create-btn"><Plus size={14} weight="bold" /> New Supplier</Btn>}
      />

      <div className="lumia-surface overflow-x-auto">
        {list.length === 0 ? (
          <Empty title="No suppliers yet" note="Add a supplier to start purchase tracking." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">Supplier</th>
                <th className="text-left px-4 py-2 font-semibold">Mobile</th>
                <th className="text-left px-4 py-2 font-semibold">GST Number</th>
                <th className="text-right px-4 py-2 font-semibold">POs</th>
                <th className="text-right px-4 py-2 font-semibold">Total Purchases</th>
                <th className="text-right px-4 py-2 font-semibold">Outstanding</th>
                <th className="text-right px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`supplier-row-${s.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.address}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-mono-num">{s.mobile}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono-num text-xs">{s.gst_number}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{s.po_count}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold">{fmtINR(s.total_purchases)}</td>
                  <td className={`px-4 py-3 text-right font-mono-num font-bold ${s.outstanding > 0 ? "text-red-700" : "text-slate-400"}`}>{fmtINR(s.outstanding)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openLedger(s)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5" title="View ledger" data-testid={`supplier-ledger-${s.id}`}><BookOpen size={16} weight="bold" /></button>
                    {s.outstanding > 0 && (
                      <button onClick={() => openPay(s)} className="text-emerald-600 hover:text-emerald-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-emerald-300 bg-emerald-50 ml-1" data-testid={`supplier-pay-${s.id}`}>Pay</button>
                    )}
                    <button onClick={() => openEdit(s)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5"><PencilSimple size={16} weight="bold" /></button>
                    <button onClick={() => remove(s.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Supplier" : "New Supplier"} testid="supplier-modal">
        <form onSubmit={save} className="space-y-4">
          <Field label="Name *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="supplier-input-name" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} data-testid="supplier-input-mobile" /></Field>
            <Field label="GST Number"><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} data-testid="supplier-input-gst" /></Field>
          </div>
          <Field label="Address"><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="supplier-submit-btn">{editing ? "Update" : "Create"}</Btn>
          </div>
        </form>
      </Modal>

      <Modal open={ledgerOpen} onClose={() => setLedgerOpen(false)} title={ledger ? `Ledger · ${ledger.supplier.name}` : "Ledger"} testid="supplier-ledger-modal">
        {ledger && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-slate-300 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Billed</div>
                <div className="font-mono-num text-xl font-black">{fmtINR(ledger.total_billed)}</div>
              </div>
              <div className="border border-slate-300 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Paid</div>
                <div className="font-mono-num text-xl font-black text-emerald-700">{fmtINR(ledger.total_paid)}</div>
              </div>
              <div className="border border-slate-300 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Outstanding</div>
                <div className={`font-mono-num text-xl font-black ${ledger.outstanding > 0 ? "text-red-700" : "text-emerald-700"}`}>{fmtINR(ledger.outstanding)}</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Purchase Orders</div>
              {ledger.purchases.length === 0 ? <div className="text-xs text-slate-500">No POs</div> : (
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="text-left px-2 py-1">PO #</th><th className="text-left px-2 py-1">Date</th><th className="text-right px-2 py-1">Total</th><th className="text-right px-2 py-1">Paid</th><th className="text-left px-2 py-1">Terms</th></tr></thead>
                  <tbody>{ledger.purchases.map((p) => (
                    <tr key={p.id} className="border-t border-slate-200">
                      <td className="px-2 py-1 font-mono-num font-semibold">{p.po_no}</td>
                      <td className="px-2 py-1 text-slate-500">{p.purchase_date?.slice(0,10)}</td>
                      <td className="px-2 py-1 text-right font-mono-num">{fmtINR(p.total)}</td>
                      <td className="px-2 py-1 text-right font-mono-num">{fmtINR(p.paid_amount)}</td>
                      <td className="px-2 py-1 uppercase text-[10px]">{p.payment_terms}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Payments</div>
              {ledger.payments.length === 0 ? <div className="text-xs text-slate-500">No payments yet</div> : (
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="text-left px-2 py-1">Date</th><th className="text-left px-2 py-1">PO</th><th className="text-left px-2 py-1">Method</th><th className="text-right px-2 py-1">Amount</th><th className="text-left px-2 py-1">Note</th></tr></thead>
                  <tbody>{ledger.payments.map((p) => (
                    <tr key={p.id} className="border-t border-slate-200">
                      <td className="px-2 py-1 text-slate-500">{p.date?.slice(0,10)}</td>
                      <td className="px-2 py-1 font-mono-num">{p.po_no || "—"}</td>
                      <td className="px-2 py-1 uppercase text-[10px]">{p.method}</td>
                      <td className="px-2 py-1 text-right font-mono-num font-bold text-emerald-700">{fmtINR(p.amount)}</td>
                      <td className="px-2 py-1 text-slate-600">{p.note}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment" testid="payment-modal">
        <form onSubmit={recordPayment} className="space-y-4">
          <Field label="Apply to Purchase Order">
            <select className="block w-full bg-white border border-slate-300 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8]" value={payForm.purchase_id} onChange={(e) => setPayForm({ ...payForm, purchase_id: e.target.value })} data-testid="payment-input-po">
              <option value="">— Not linked to a PO —</option>
              {unpaidPOs.map((p) => (
                <option key={p.id} value={p.id}>{p.po_no} · Due {fmtINR(p.total - p.paid_amount)}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount (₹) *"><Input required type="number" min="0.01" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} data-testid="payment-input-amount" /></Field>
            <Field label="Method">
              <select className="block w-full bg-white border border-slate-300 px-3 py-2 text-sm rounded-sm" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                <option value="bank">Bank Transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="cheque">Cheque</option>
              </select>
            </Field>
          </div>
          <Field label="Note"><Input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setPayOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="payment-submit-btn">Record Payment</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
