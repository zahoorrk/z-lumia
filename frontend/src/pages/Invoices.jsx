import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Textarea, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, FilePdf, WhatsappLogo, EnvelopeSimple, PencilSimple, Trash, CurrencyInr, Receipt } from "@phosphor-icons/react";
import { toast } from "sonner";
import jsPDF from "jspdf";

const emptyItem = { description: "", qty: 1, unit_price: 0 };
const emptyForm = { project_id: "", client_name: "", client_gstin: "", client_state: "Maharashtra", items: [{ ...emptyItem }], gst_pct: 18, advance_received: 0, notes: "", due_date: "" };

function invoicePDF(inv, company) {
  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(20).setFont("helvetica", "bold").text(company.name, 14, 18);
  doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(80);
  doc.text(company.address, 14, 24);
  doc.text(`GSTIN: ${company.gstin}  ·  ${company.phone}  ·  ${company.email}`, 14, 29);
  doc.setTextColor(0);
  doc.setDrawColor(15, 59, 232).setLineWidth(0.8).line(14, 33, 196, 33);

  doc.setFontSize(16).setFont("helvetica", "bold").text("TAX INVOICE", 14, 42);
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text(`Invoice #: ${inv.invoice_no}`, 140, 42);
  doc.text(`Date: ${(inv.invoice_date || "").slice(0,10)}`, 140, 47);

  let y = 52;
  doc.setFont("helvetica", "bold").text("Bill To:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(inv.client_name, 14, y + 5);
  if (inv.client_gstin) doc.text(`GSTIN: ${inv.client_gstin}`, 14, y + 10);
  if (inv.client_state) doc.text(`State: ${inv.client_state}`, 14, y + 15);
  doc.text(`Project: ${inv.project_name || ""}`, 14, y + 20);

  y = 80;
  doc.setFillColor(15, 23, 42).rect(14, y, 182, 7, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(9);
  doc.text("Description", 16, y + 5); doc.text("Qty", 130, y + 5); doc.text("Rate", 150, y + 5); doc.text("Amount", 178, y + 5);
  doc.setTextColor(0).setFont("helvetica", "normal");
  y += 10;
  inv.items.forEach((it) => {
    const amt = it.qty * it.unit_price;
    doc.text(it.description.slice(0, 60), 16, y);
    doc.text(String(it.qty), 130, y);
    doc.text(`₹${it.unit_price.toLocaleString("en-IN")}`, 150, y);
    doc.text(`₹${amt.toLocaleString("en-IN")}`, 178, y);
    y += 6;
  });

  y += 4;
  doc.setDrawColor(200).line(120, y, 196, y); y += 6;
  const totalRow = (label, val, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, 130, y); doc.text(`₹${val.toLocaleString("en-IN")}`, 178, y); y += 6;
  };
  totalRow("Subtotal", inv.subtotal);
  if (inv.igst > 0) totalRow(`IGST (${inv.gst_pct}%)`, inv.igst);
  else { totalRow(`CGST (${inv.gst_pct/2}%)`, inv.cgst); totalRow(`SGST (${inv.gst_pct/2}%)`, inv.sgst); }
  doc.setDrawColor(200).line(120, y, 196, y); y += 6;
  totalRow("Total", inv.total, true);
  totalRow("Received", inv.amount_received);
  doc.setTextColor(220, 38, 38);
  totalRow("Outstanding", inv.outstanding, true);
  doc.setTextColor(0);

  y += 12;
  doc.setFontSize(8).setTextColor(120);
  doc.text(`Status: ${inv.status.toUpperCase()}`, 14, y);
  if (inv.due_date) doc.text(`Due Date: ${inv.due_date.slice(0,10)}`, 14, y + 4);
  doc.text(`Generated ${new Date().toLocaleString("en-IN")} · LUMIASIGN ERP`, 14, 285);

  doc.save(`${inv.invoice_no}.pdf`);
}

export default function Invoices() {
  const [list, setList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, mode: "bank", note: "" });

  const company = {
    name: "LUMIASIGN LLP",
    gstin: "27AABCL1234A1Z5",
    address: "Plot 14, Industrial Estate, Mumbai 400099",
    phone: "+91 98765 43210", email: "hello@lumiasign.com",
  };

  const load = async () => {
    const [i, p] = await Promise.all([api.get("/invoices"), api.get("/projects")]);
    setList(i.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const total = list.reduce((s, i) => s + i.total, 0);
    const received = list.reduce((s, i) => s + i.amount_received, 0);
    const out = list.reduce((s, i) => s + i.outstanding, 0);
    return { total, received, out };
  }, [list]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, project_id: projects[0]?.id || "", client_name: projects[0]?.client_name || "" });
    setOpen(true);
  };
  const openEdit = (inv) => { setEditing(inv); setForm({ project_id: inv.project_id, client_name: inv.client_name, client_gstin: inv.client_gstin || "", client_state: inv.client_state || "Maharashtra", items: inv.items?.length ? inv.items : [{ ...emptyItem }], gst_pct: inv.gst_pct, advance_received: inv.advance_received, notes: inv.notes || "", due_date: inv.due_date?.slice(0,10) || "" }); setOpen(true); };

  const setItem = (i, k, v) => { const items = [...form.items]; items[i] = { ...items[i], [k]: k === "description" ? v : Number(v) || 0 }; setForm({ ...form, items }); };
  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const rmItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const calc = useMemo(() => {
    const subtotal = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
    const gst = subtotal * (Number(form.gst_pct) || 0) / 100;
    return { subtotal, gst, total: subtotal + gst };
  }, [form]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, gst_pct: Number(form.gst_pct), advance_received: Number(form.advance_received) || 0, items: form.items.filter((i) => i.description.trim()) };
      if (editing) await api.put(`/invoices/${editing.id}`, payload);
      else await api.post("/invoices", payload);
      toast.success(editing ? "Invoice updated" : "Invoice created");
      setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const remove = async (id) => { if (!window.confirm("Delete invoice?")) return; await api.delete(`/invoices/${id}`); load(); };

  const openPayment = (inv) => { setPayTarget(inv); setPayForm({ amount: inv.outstanding, mode: "bank", note: "" }); setPayOpen(true); };
  const recordPay = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/invoices/${payTarget.id}/payments`, { ...payForm, amount: Number(payForm.amount) });
      toast.success("Payment recorded"); setPayOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const sendWA = async (inv) => {
    const phone = window.prompt("Client WhatsApp number with country code (e.g. +91 98765 43210):");
    if (!phone) return;
    const { data } = await api.get("/messaging/whatsapp-link", { params: { phone, template: "invoice_generated", invoice_id: inv.id } });
    window.open(data.link, "_blank");
  };
  const sendEmail = async (inv) => {
    const to = window.prompt("Client email:");
    if (!to) return;
    const { data } = await api.get("/messaging/email-link", { params: { to, template: "invoice_generated", invoice_id: inv.id } });
    window.location.href = data.link;
  };

  return (
    <div className="p-6 lg:p-8" data-testid="invoices-page">
      <PageHeader subtitle="Accounts" title="Invoices"
        action={<Btn onClick={openCreate} data-testid="invoice-create-btn"><Plus size={14} weight="bold" /> New Invoice</Btn>}
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="lumia-surface p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Total Invoiced</div><div className="text-2xl font-black font-mono-num">{fmtINR(totals.total)}</div></div>
        <div className="lumia-surface p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Collected</div><div className="text-2xl font-black font-mono-num text-emerald-700">{fmtINR(totals.received)}</div></div>
        <div className="lumia-surface p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Outstanding</div><div className="text-2xl font-black font-mono-num text-red-700">{fmtINR(totals.out)}</div></div>
      </div>

      <div className="lumia-surface overflow-x-auto">
        {list.length === 0 ? <Empty title="No invoices yet" note="Create your first GST invoice from a project." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold">Inv #</th>
              <th className="text-left px-3 py-2 font-semibold">Date</th>
              <th className="text-left px-3 py-2 font-semibold">Client</th>
              <th className="text-left px-3 py-2 font-semibold">Project</th>
              <th className="text-right px-3 py-2 font-semibold">Subtotal</th>
              <th className="text-right px-3 py-2 font-semibold">GST</th>
              <th className="text-right px-3 py-2 font-semibold">Total</th>
              <th className="text-right px-3 py-2 font-semibold">Received</th>
              <th className="text-right px-3 py-2 font-semibold">Outstanding</th>
              <th className="text-left px-3 py-2 font-semibold">Status</th>
              <th className="text-right px-3 py-2 font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`invoice-row-${i.id}`}>
                  <td className="px-3 py-3 font-mono-num font-semibold">{i.invoice_no}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{i.invoice_date?.slice(0,10)}</td>
                  <td className="px-3 py-3 font-semibold">{i.client_name}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{i.project_no} · {i.project_name}</td>
                  <td className="px-3 py-3 text-right font-mono-num">{fmtINR(i.subtotal)}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-xs">{fmtINR(i.gst_amount)}</td>
                  <td className="px-3 py-3 text-right font-mono-num font-bold">{fmtINR(i.total)}</td>
                  <td className="px-3 py-3 text-right font-mono-num text-emerald-700">{fmtINR(i.amount_received)}</td>
                  <td className={`px-3 py-3 text-right font-mono-num font-bold ${i.outstanding > 0 ? "text-red-700" : "text-slate-400"}`}>{fmtINR(i.outstanding)}</td>
                  <td className="px-3 py-3"><StatusBadge status={i.status} /></td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {i.outstanding > 0 && <button onClick={() => openPayment(i)} className="text-emerald-700 hover:text-emerald-900 p-1.5" title="Record payment" data-testid={`invoice-pay-${i.id}`}><CurrencyInr size={16} weight="bold" /></button>}
                    <button onClick={() => invoicePDF(i, company)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5" title="Download PDF" data-testid={`invoice-pdf-${i.id}`}><FilePdf size={16} weight="bold" /></button>
                    <button onClick={() => sendWA(i)} className="text-slate-500 hover:text-emerald-600 p-1.5" title="WhatsApp"><WhatsappLogo size={16} weight="bold" /></button>
                    <button onClick={() => sendEmail(i)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5" title="Email"><EnvelopeSimple size={16} weight="bold" /></button>
                    <button onClick={() => openEdit(i)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5"><PencilSimple size={16} weight="bold" /></button>
                    <button onClick={() => remove(i.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Invoice" : "New Tax Invoice"} testid="invoice-modal">
        <form onSubmit={save} className="space-y-4">
          <Field label="Project *">
            <Select required value={form.project_id} onChange={(e) => { const p = projects.find((x) => x.id === e.target.value); setForm({ ...form, project_id: e.target.value, client_name: p?.client_name || form.client_name }); }} data-testid="invoice-input-project">
              <option value="">— Select —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Client *"><Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} data-testid="invoice-input-client" /></Field>
            <Field label="Client GSTIN"><Input value={form.client_gstin} onChange={(e) => setForm({ ...form, client_gstin: e.target.value })} /></Field>
            <Field label="Client State"><Input value={form.client_state} onChange={(e) => setForm({ ...form, client_state: e.target.value })} /></Field>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Line items</span>
              <button type="button" onClick={addItem} className="text-xs text-[#0F3BE8] font-bold uppercase tracking-wider">+ Add</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-6" placeholder="Description" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} data-testid={`invoice-item-desc-${i}`} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
                  <Input className="col-span-3" type="number" placeholder="Unit price" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} />
                  <button type="button" onClick={() => rmItem(i)} className="col-span-1 text-slate-400 hover:text-red-600"><Trash size={16} /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="GST %"><Input type="number" value={form.gst_pct} onChange={(e) => setForm({ ...form, gst_pct: e.target.value })} /></Field>
            <Field label="Advance Received (₹)"><Input type="number" value={form.advance_received} onChange={(e) => setForm({ ...form, advance_received: e.target.value })} /></Field>
            <Field label="Due Date"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          </div>
          <div className="bg-slate-50 border border-slate-300 p-3 grid grid-cols-3 text-sm">
            <div><div className="text-[10px] uppercase text-slate-500 font-bold">Subtotal</div><div className="font-mono-num font-bold">{fmtINR(calc.subtotal)}</div></div>
            <div><div className="text-[10px] uppercase text-slate-500 font-bold">GST</div><div className="font-mono-num font-bold">{fmtINR(calc.gst)}</div></div>
            <div><div className="text-[10px] uppercase text-slate-500 font-bold">Total</div><div className="font-mono-num text-xl font-black text-[#0F3BE8]">{fmtINR(calc.total)}</div></div>
          </div>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="invoice-submit-btn">{editing ? "Update" : "Create Invoice"}</Btn>
          </div>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={payTarget ? `Record Payment · ${payTarget.invoice_no}` : "Payment"} testid="invoice-pay-modal">
        <form onSubmit={recordPay} className="space-y-4">
          {payTarget && <div className="text-xs text-slate-500">Outstanding: <span className="font-mono-num font-bold text-red-700">{fmtINR(payTarget.outstanding)}</span></div>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount *"><Input required type="number" min="0.01" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} data-testid="invoice-pay-amount" /></Field>
            <Field label="Mode">
              <Select value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option><option value="cheque">Cheque</option><option value="credit">Credit</option>
              </Select>
            </Field>
          </div>
          <Field label="Note"><Input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Btn variant="ghost" type="button" onClick={() => setPayOpen(false)}>Cancel</Btn><Btn variant="primary" type="submit" data-testid="invoice-pay-submit">Record</Btn></div>
        </form>
      </Modal>
    </div>
  );
}
