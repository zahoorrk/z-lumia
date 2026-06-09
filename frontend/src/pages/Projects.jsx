import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Textarea, Empty } from "@/components/Bits";
import { fmtINR, statusLabel } from "@/lib/constants";
import { Plus, MagnifyingGlass, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const STATUSES = ["new", "in_production", "installation", "completed", "cancelled"];
const emptyForm = {
  name: "", client_name: "", contract_value: 0, status: "new",
  start_date: "", end_date: "", description: "",
};

export default function Projects() {
  const { user } = useAuth();
  const canWrite = ["admin", "sales", "production"].includes(user?.role);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (statusFilter !== "all") params.status = statusFilter;
    api.get("/projects", { params }).then((r) => setList(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, statusFilter]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...emptyForm, ...p }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, contract_value: Number(form.contract_value) || 0 };
      if (editing) await api.put(`/projects/${editing.id}`, payload);
      else await api.post("/projects", payload);
      toast.success(editing ? "Project updated" : "Project created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete project?")) return;
    await api.delete(`/projects/${id}`);
    load();
  };

  const summary = useMemo(() => {
    const total = list.length;
    const inflight = list.filter((p) => p.status !== "completed" && p.status !== "cancelled").length;
    const value = list.reduce((s, p) => s + (p.contract_value || 0), 0);
    return { total, inflight, value };
  }, [list]);

  return (
    <div className="p-6 lg:p-8" data-testid="projects-page">
      <PageHeader
        subtitle="Delivery"
        title="Projects"
        action={
          canWrite && (
            <Btn onClick={openCreate} data-testid="project-create-btn">
              <Plus size={14} weight="bold" /> New Project
            </Btn>
          )
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="lumia-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total</div>
          <div className="text-2xl font-black font-mono-num">{summary.total}</div>
        </div>
        <div className="lumia-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">In Flight</div>
          <div className="text-2xl font-black font-mono-num text-[#0F3BE8]">{summary.inflight}</div>
        </div>
        <div className="lumia-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Book Value</div>
          <div className="text-2xl font-black font-mono-num">{fmtINR(summary.value)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="project-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, client, project no…"
            className="pl-9 pr-3 py-2 w-72 bg-white border border-slate-300 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8]"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-44" data-testid="project-status-filter">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
      </div>

      <div className="lumia-surface overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : list.length === 0 ? (
          <Empty title="No projects" note="Adjust filters or create a project." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">Project #</th>
                <th className="text-left px-4 py-2 font-semibold">Name</th>
                <th className="text-left px-4 py-2 font-semibold">Client</th>
                <th className="text-right px-4 py-2 font-semibold">Contract</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                {canWrite && <th className="text-right px-4 py-2 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`project-row-${p.id}`}>
                  <td className="px-4 py-3 font-mono-num font-semibold text-slate-900">{p.project_no}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-700">{p.client_name}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{fmtINR(p.contract_value)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5" data-testid={`project-edit-${p.id}`}><PencilSimple size={16} weight="bold" /></button>
                      {(user?.role === "admin" || user?.role === "sales") && (
                        <button onClick={() => remove(p.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Project" : "New Project"} testid="project-modal">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="project-input-name" /></Field>
            <Field label="Client *"><Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} data-testid="project-input-client" /></Field>
            <Field label="Contract Value (₹)"><Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} data-testid="project-input-value" /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} data-testid="project-input-status">
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </Select>
            </Field>
            <Field label="Start Date"><Input type="date" value={form.start_date?.slice(0,10) || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="End Date"><Input type="date" value={form.end_date?.slice(0,10) || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="project-submit-btn">{editing ? "Update" : "Create"}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
