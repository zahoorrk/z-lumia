import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, Modal, Field, Empty, StatusBadge } from "@/components/Bits";
import { PRODUCTION_STAGES } from "@/lib/constants";
import { Plus, Factory, CheckCircle, Play, Pause, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const STATUS_NEXT = { pending: "in_progress", in_progress: "completed", completed: "pending" };
const STATUS_ICON = { pending: Pause, in_progress: Play, completed: CheckCircle };
const STATUS_BG = {
  pending: "bg-slate-100 text-slate-600 border-slate-300",
  in_progress: "bg-amber-50 text-amber-800 border-amber-300",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-300",
};

export default function Production() {
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    const [j, p] = await Promise.all([api.get("/production"), api.get("/projects")]);
    setJobs(j.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const approvedProjects = useMemo(() => projects.filter((p) => p.approved && !p.production_completed), [projects]);

  const openCreate = () => { setSelectedProject(approvedProjects[0]?.id || ""); setNotes(""); setOpen(true); };

  const createJob = async (e) => {
    e.preventDefault();
    if (!selectedProject) { toast.error("Select an approved project"); return; }
    try {
      await api.post("/production", { project_id: selectedProject, notes });
      toast.success("Job created"); setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const updateStage = async (job, idx, newStatus) => {
    try {
      await api.put(`/production/${job.id}/stage/${idx}`, { status: newStatus });
      toast.success("Stage updated"); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const removeJob = async (id) => {
    if (!window.confirm("Delete job?")) return;
    await api.delete(`/production/${id}`); load();
  };

  const stats = {
    total: jobs.length,
    inProgress: jobs.filter((j) => j.stages.some((s) => s.status === "in_progress")).length,
    completed: jobs.filter((j) => j.progress === 100).length,
  };

  return (
    <div className="p-6 lg:p-8" data-testid="production-page">
      <PageHeader
        subtitle="Factory Floor"
        title="Production"
        action={<Btn onClick={openCreate} data-testid="prod-create-btn"><Plus size={14} weight="bold" /> New Job</Btn>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="lumia-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Jobs</div>
          <div className="text-2xl font-black font-mono-num">{stats.total}</div>
        </div>
        <div className="lumia-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">In Progress</div>
          <div className="text-2xl font-black font-mono-num text-[#FF4B00]">{stats.inProgress}</div>
        </div>
        <div className="lumia-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Completed</div>
          <div className="text-2xl font-black font-mono-num text-emerald-700">{stats.completed}</div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <Empty title="No production jobs" note="Create a job from an approved project to start tracking stages." />
      ) : (
        <div className="space-y-4" data-testid="production-list">
          {jobs.map((job) => (
            <div key={job.id} className="lumia-surface p-5" data-testid={`prod-job-${job.id}`}>
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-xs text-slate-500 font-semibold">{job.job_no}</span>
                    <Factory size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-500">{job.project_no}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">{job.project_name}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Progress</div>
                    <div className="font-mono-num font-black text-xl">{job.progress}%</div>
                  </div>
                  <div className="w-32 h-2 bg-slate-100">
                    <div className="h-2 bg-[#0F3BE8] transition-all" style={{ width: `${job.progress}%` }} />
                  </div>
                  <button onClick={() => removeJob(job.id)} className="text-slate-400 hover:text-red-600 p-2"><Trash size={16} weight="bold" /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                {job.stages.map((s, idx) => {
                  const Icon = STATUS_ICON[s.status];
                  return (
                    <button
                      key={idx}
                      onClick={() => updateStage(job, idx, STATUS_NEXT[s.status])}
                      data-testid={`prod-stage-${job.id}-${idx}`}
                      className={`border p-3 text-left transition-colors ${STATUS_BG[s.status]} hover:border-[#0F3BE8]`}
                      title={`Click to ${STATUS_NEXT[s.status].replace("_", " ")}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{idx + 1}</span>
                        <Icon size={14} weight="bold" />
                      </div>
                      <div className="text-xs font-bold text-slate-900">{s.name}</div>
                      <div className="text-[10px] uppercase tracking-wider mt-1 font-semibold">
                        {s.status.replace("_", " ")}
                      </div>
                    </button>
                  );
                })}
              </div>
              {job.notes && <div className="mt-3 text-xs text-slate-500 italic">{job.notes}</div>}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Production Job" testid="prod-modal">
        <form onSubmit={createJob} className="space-y-4">
          {approvedProjects.length === 0 ? (
            <div className="border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3">
              No approved projects available. <b>Sales must approve a project</b> before production can start.
            </div>
          ) : (
            <>
              <Field label="Approved Project *">
                <select required value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} data-testid="prod-input-project" className="block w-full bg-white border border-slate-300 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#0F3BE8]">
                  {approvedProjects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="block w-full bg-white border border-slate-300 px-3 py-2 text-sm rounded-sm" />
              </Field>
              <div className="text-xs text-slate-500">
                Will auto-create 8 stages: {PRODUCTION_STAGES.join(" → ")}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={approvedProjects.length === 0} data-testid="prod-submit-btn">Create Job</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
