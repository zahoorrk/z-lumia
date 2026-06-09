import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Textarea, Empty } from "@/components/Bits";
import { fmtINR } from "@/lib/constants";
import { Plus, MagnifyingGlass, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const STATUSES = ["new", "contacted", "qualified", "won", "lost"];
const SOURCES = ["Website", "Referral", "Cold Call", "Exhibition", "Walk-in", "Other"];

const emptyForm = {
  name: "", company: "", phone: "", email: "", source: "Website",
  status: "new", notes: "", estimated_value: 0,
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    api.get("/leads").then((r) => setLeads(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l) => { setEditing(l); setForm({ ...emptyForm, ...l }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, estimated_value: Number(form.estimated_value) || 0 };
      if (editing) {
        await api.put(`/leads/${editing.id}`, payload);
        toast.success("Lead updated");
      } else {
        await api.post("/leads", payload);
        toast.success("Lead created");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    await api.delete(`/leads/${id}`);
    toast.success("Lead removed");
    load();
  };

  const filtered = leads.filter((l) => {
    const s = q.toLowerCase();
    return !s || l.name.toLowerCase().includes(s) || (l.company || "").toLowerCase().includes(s);
  });

  return (
    <div className="p-6 lg:p-8" data-testid="leads-page">
      <PageHeader
        subtitle="Sales Pipeline"
        title="Leads"
        action={
          <Btn onClick={openCreate} variant="primary" data-testid="lead-create-btn">
            <Plus size={14} weight="bold" /> New Lead
          </Btn>
        }
      />

      <div className="mb-4 flex items-center gap-2 max-w-sm relative">
        <MagnifyingGlass size={16} className="absolute left-3 text-slate-400" />
        <input
          data-testid="lead-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search leads by name or company…"
          className="pl-9 pr-3 py-2 w-full bg-white border border-slate-300 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8]"
        />
      </div>

      <div className="lumia-surface overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <Empty title="No leads yet" note="Create your first lead to start the pipeline." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">Lead</th>
                <th className="text-left px-4 py-2 font-semibold">Company</th>
                <th className="text-left px-4 py-2 font-semibold">Contact</th>
                <th className="text-left px-4 py-2 font-semibold">Source</th>
                <th className="text-right px-4 py-2 font-semibold">Est. Value</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-right px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-slate-200 hover:bg-slate-50"
                  data-testid={`lead-row-${l.id}`}
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">{l.name}</td>
                  <td className="px-4 py-3 text-slate-700">{l.company}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    <div>{l.phone}</div>
                    <div className="text-slate-400">{l.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.source}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{fmtINR(l.estimated_value)}</td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(l)}
                      className="text-slate-500 hover:text-[#0F3BE8] p-1.5"
                      data-testid={`lead-edit-${l.id}`}
                    >
                      <PencilSimple size={16} weight="bold" />
                    </button>
                    <button
                      onClick={() => remove(l.id)}
                      className="text-slate-500 hover:text-red-600 p-1.5"
                      data-testid={`lead-delete-${l.id}`}
                    >
                      <Trash size={16} weight="bold" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Lead" : "New Lead"} testid="lead-modal">
        <form onSubmit={save} className="space-y-4" data-testid="lead-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name *">
              <Input data-testid="lead-input-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Company">
              <Input data-testid="lead-input-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input data-testid="lead-input-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input data-testid="lead-input-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Source">
              <Select data-testid="lead-input-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select data-testid="lead-input-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Estimated Value (₹)">
              <Input data-testid="lead-input-value" type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea data-testid="lead-input-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="lead-submit-btn">{editing ? "Update Lead" : "Create Lead"}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
