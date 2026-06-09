import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Textarea, Empty } from "@/components/Bits";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const STATUSES = ["scheduled", "in_progress", "completed"];

export default function InstallationPage() {
  const [list, setList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ project_id: "", site_address: "", scheduled_date: "", team: "", status: "scheduled", notes: "" });

  const load = async () => {
    const [i, p] = await Promise.all([api.get("/installations"), api.get("/projects")]);
    setList(i.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ project_id: projects[0]?.id || "", site_address: "", scheduled_date: "", team: "", status: "scheduled", notes: "" }); setOpen(true); };
  const openEdit = (i) => { setEditing(i); setForm({ project_id: i.project_id, site_address: i.site_address, scheduled_date: i.scheduled_date?.slice(0,10) || "", team: i.team || "", status: i.status, notes: i.notes || "" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/installations/${editing.id}`, form);
      else await api.post("/installations", form);
      toast.success(editing ? "Installation updated" : "Installation scheduled");
      setOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete installation?")) return;
    await api.delete(`/installations/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-8" data-testid="installation-page">
      <PageHeader
        subtitle="Site Operations"
        title="Installation"
        action={<Btn onClick={openCreate} data-testid="inst-create-btn"><Plus size={14} weight="bold" /> Schedule Install</Btn>}
      />

      <div className="lumia-surface overflow-x-auto">
        {list.length === 0 ? (
          <Empty title="Nothing scheduled" note="Schedule an installation visit from a project." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">Project</th>
                <th className="text-left px-4 py-2 font-semibold">Site Address</th>
                <th className="text-left px-4 py-2 font-semibold">Scheduled</th>
                <th className="text-left px-4 py-2 font-semibold">Team</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-right px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold">{i.project_name}</td>
                  <td className="px-4 py-3 text-slate-700">{i.site_address}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{i.scheduled_date ? new Date(i.scheduled_date).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="px-4 py-3">{i.team}</td>
                  <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(i)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5"><PencilSimple size={16} weight="bold" /></button>
                    <button onClick={() => remove(i.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Installation" : "Schedule Installation"} testid="inst-modal">
        <form onSubmit={save} className="space-y-4">
          <Field label="Project *">
            <Select required value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} data-testid="inst-input-project">
              <option value="">— Select project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
            </Select>
          </Field>
          <Field label="Site Address *"><Textarea required rows={2} value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} data-testid="inst-input-address" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Scheduled Date"><Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></Field>
            <Field label="Team"><Input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="inst-submit-btn">{editing ? "Update" : "Schedule"}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
