import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Textarea, Empty } from "@/components/Bits";
import { statusLabel } from "@/lib/constants";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const STAGES = ["queued", "cutting", "printing", "fabrication", "finishing", "qc", "done"];

export default function Production() {
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ project_id: "", stage: "queued", assigned_to: "", progress: 0, notes: "" });

  const load = async () => {
    const [a, b] = await Promise.all([api.get("/production"), api.get("/projects")]);
    setJobs(a.data); setProjects(b.data);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ project_id: projects[0]?.id || "", stage: "queued", assigned_to: "", progress: 0, notes: "" }); setOpen(true); };
  const openEdit = (j) => { setEditing(j); setForm({ project_id: j.project_id, stage: j.stage, assigned_to: j.assigned_to || "", progress: j.progress, notes: j.notes || "" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, progress: Number(form.progress) || 0 };
      if (editing) await api.put(`/production/${editing.id}`, payload);
      else await api.post("/production", payload);
      toast.success(editing ? "Job updated" : "Job created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete job?")) return;
    await api.delete(`/production/${id}`);
    load();
  };

  return (
    <div className="p-6 lg:p-8" data-testid="production-page">
      <PageHeader
        subtitle="Factory Floor"
        title="Production"
        action={<Btn onClick={openCreate} data-testid="prod-create-btn"><Plus size={14} weight="bold" /> New Job</Btn>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3" data-testid="production-board">
        {STAGES.map((stage) => {
          const stageJobs = jobs.filter((j) => j.stage === stage);
          return (
            <div key={stage} className="lumia-surface p-3 min-h-[280px]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-700">{statusLabel(stage)}</div>
                <span className="text-xs font-mono-num text-slate-500">{stageJobs.length}</span>
              </div>
              <div className="space-y-2">
                {stageJobs.map((j) => (
                  <div key={j.id} className="border border-slate-200 bg-white p-2 hover:border-[#0F3BE8] cursor-pointer transition-colors" onClick={() => openEdit(j)} data-testid={`prod-card-${j.id}`}>
                    <div className="text-xs font-semibold text-slate-900 truncate">{j.project_name}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{j.assigned_to || "Unassigned"}</div>
                    <div className="mt-2 h-1 bg-slate-100">
                      <div className="h-1 bg-[#0F3BE8]" style={{ width: `${j.progress}%` }} />
                    </div>
                  </div>
                ))}
                {stageJobs.length === 0 && <div className="text-[11px] text-slate-400 italic">No jobs</div>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Job" : "New Production Job"} testid="prod-modal">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Project *">
              <Select required value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} data-testid="prod-input-project">
                <option value="">— Select project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
              </Select>
            </Field>
            <Field label="Stage">
              <Select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </Select>
            </Field>
            <Field label="Assigned To"><Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} /></Field>
            <Field label="Progress (%)"><Input type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-between pt-2">
            {editing && <Btn variant="danger" type="button" onClick={() => { remove(editing.id); setOpen(false); }}><Trash size={14} weight="bold" /> Delete</Btn>}
            <div className="flex gap-2 ml-auto">
              <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
              <Btn variant="primary" type="submit" data-testid="prod-submit-btn">{editing ? "Update" : "Create"}</Btn>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
