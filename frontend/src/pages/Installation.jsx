import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Btn, StatusBadge, Modal, Field, Input, Select, Textarea, Empty } from "@/components/Bits";
import { Plus, PencilSimple, Trash, Camera, FilePdf, Signature, CheckCircle, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import SignaturePad from "@/components/SignaturePad";
import jsPDF from "jspdf";

const STATUSES = ["scheduled", "in_progress", "completed"];

function PhotoGrid({ photos, bucket, onRemove }) {
  if (!photos || photos.length === 0)
    return <div className="text-xs text-slate-400 italic">No {bucket} photos yet</div>;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {photos.map((p, i) => (
        <div key={i} className="relative group border border-slate-300">
          <img src={p} alt="" className="w-full h-24 object-cover" />
          <button
            type="button"
            onClick={() => onRemove(bucket, i)}
            className="absolute top-1 right-1 bg-black/70 text-white p-1 opacity-0 group-hover:opacity-100"
            data-testid={`photo-remove-${bucket}-${i}`}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function compressImage(file, maxSize = 1024, quality = 0.7) {
  const url = await fileToDataUrl(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > height && width > maxSize) { height *= maxSize / width; width = maxSize; }
      else if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = url;
  });
}

function generatePDF(inst) {
  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(20).setFont("helvetica", "bold");
  doc.text("LUMIASIGN LLP", 14, 18);
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text("Installation Completion Report", 14, 24);

  doc.setDrawColor(15, 59, 232).setLineWidth(0.8);
  doc.line(14, 28, 196, 28);

  let y = 38;
  const row = (label, val) => {
    doc.setFont("helvetica", "bold").setFontSize(9).text(label, 14, y);
    doc.setFont("helvetica", "normal").setFontSize(10).text(String(val || "—"), 60, y);
    y += 6;
  };
  row("Installation #", inst.install_no);
  row("Project #", inst.project_no);
  row("Project Name", inst.project_name);
  row("Site Location", inst.site_location);
  row("Team Leader", inst.team_leader);
  row("Installation Date", inst.installation_date?.slice(0,10) || "");
  row("Status", inst.status?.toUpperCase());

  y += 4;
  doc.setFont("helvetica", "bold").setFontSize(11).text("Photo Evidence", 14, y); y += 6;
  doc.setFontSize(9).setFont("helvetica", "normal");
  const counts = {
    Before: inst.before_photos?.length || 0,
    During: inst.during_photos?.length || 0,
    After: inst.after_photos?.length || 0,
  };
  Object.entries(counts).forEach(([k, v]) => { doc.text(`${k}: ${v} photo(s)`, 14, y); y += 5; });

  // Embed first 4 after-photos
  const photos = (inst.after_photos || []).slice(0, 4);
  let px = 14, py = y + 4;
  photos.forEach((p, idx) => {
    try { doc.addImage(p, "JPEG", px, py, 42, 32); } catch (e) {}
    px += 46;
    if ((idx + 1) % 4 === 0) { px = 14; py += 36; }
  });

  y = py + 40;
  doc.setFont("helvetica", "bold").setFontSize(11).text("Client Sign-Off", 14, y); y += 6;
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text(`Name: ${inst.client_name_signoff || "—"}`, 14, y); y += 5;
  doc.text(`Signed on: ${inst.signed_at ? new Date(inst.signed_at).toLocaleString("en-IN") : "—"}`, 14, y); y += 8;
  if (inst.client_signature) {
    try { doc.addImage(inst.client_signature, "PNG", 14, y, 80, 30); } catch (e) {}
    y += 32;
  }
  doc.setFontSize(8).setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString("en-IN")} · LUMIASIGN ERP`, 14, 285);
  doc.save(`${inst.install_no}_completion_report.pdf`);
}

export default function InstallationPage() {
  const [list, setList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ project_id: "", site_location: "", team_leader: "", installation_date: "", status: "scheduled", notes: "" });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signature, setSignature] = useState("");
  const [signerName, setSignerName] = useState("");
  const fileRefs = { before: useRef(), during: useRef(), after: useRef() };

  const load = async () => {
    const [i, p] = await Promise.all([api.get("/installations"), api.get("/projects")]);
    setList(i.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const eligibleProjects = useMemo(
    () => projects.filter((p) => p.production_completed && p.status !== "completed"),
    [projects]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ project_id: eligibleProjects[0]?.id || "", site_location: "", team_leader: "", installation_date: new Date().toISOString().slice(0,10), status: "scheduled", notes: "" });
    setOpen(true);
  };

  const openEdit = (i) => {
    setEditing(i);
    setForm({ project_id: i.project_id, site_location: i.site_location, team_leader: i.team_leader || "", installation_date: i.installation_date?.slice(0,10) || "", status: i.status, notes: i.notes || "" });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const { project_id, ...rest } = form;
        await api.put(`/installations/${editing.id}`, rest);
      } else {
        await api.post("/installations", form);
      }
      toast.success(editing ? "Installation updated" : "Installation scheduled");
      setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Save failed"); }
  };

  const remove = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/installations/${id}`); load(); };

  const openDetail = async (i) => { const { data } = await api.get(`/installations/${i.id}`); setDetail(data); setDetailOpen(true); };

  const uploadPhotos = async (bucket, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !detail) return;
    try {
      for (const f of files) {
        const dataUrl = await compressImage(f);
        await api.post(`/installations/${detail.id}/photo`, { bucket, data_url: dataUrl });
      }
      const { data } = await api.get(`/installations/${detail.id}`);
      setDetail(data); load();
      toast.success(`${files.length} ${bucket} photo(s) uploaded`);
    } catch (err) { toast.error("Upload failed"); }
    e.target.value = "";
  };

  const removePhoto = async (bucket, idx) => {
    await api.delete(`/installations/${detail.id}/photo`, { params: { bucket, index: idx } });
    const { data } = await api.get(`/installations/${detail.id}`);
    setDetail(data); load();
  };

  const submitSignoff = async (e) => {
    e.preventDefault();
    if (!signature || !signerName.trim()) { toast.error("Please sign and enter name"); return; }
    try {
      await api.post(`/installations/${detail.id}/signoff`, { client_name: signerName, signature });
      toast.success("Client sign-off captured");
      setSignOpen(false); setSignature(""); setSignerName("");
      const { data } = await api.get(`/installations/${detail.id}`);
      setDetail(data); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
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
          <Empty title="Nothing scheduled" note="Production must be completed before installation can start." />
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="text-left px-4 py-2 font-semibold">Install #</th>
              <th className="text-left px-4 py-2 font-semibold">Project</th>
              <th className="text-left px-4 py-2 font-semibold">Site</th>
              <th className="text-left px-4 py-2 font-semibold">Date</th>
              <th className="text-left px-4 py-2 font-semibold">Team Leader</th>
              <th className="text-left px-4 py-2 font-semibold">Photos</th>
              <th className="text-left px-4 py-2 font-semibold">Signed</th>
              <th className="text-left px-4 py-2 font-semibold">Status</th>
              <th className="text-right px-4 py-2 font-semibold">Actions</th>
            </tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`inst-row-${i.id}`}>
                  <td className="px-4 py-3 font-mono-num font-semibold">{i.install_no}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{i.project_name}</div>
                    <div className="text-xs text-slate-500 font-mono-num">{i.project_no}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs max-w-[200px] truncate">{i.site_location}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{i.installation_date?.slice(0,10)}</td>
                  <td className="px-4 py-3">{i.team_leader}</td>
                  <td className="px-4 py-3 text-xs font-mono-num">
                    {(i.before_photos?.length || 0)} · {(i.during_photos?.length || 0)} · {(i.after_photos?.length || 0)}
                  </td>
                  <td className="px-4 py-3">
                    {i.client_signature
                      ? <CheckCircle size={18} weight="fill" className="text-emerald-600" />
                      : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openDetail(i)} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100" data-testid={`inst-open-${i.id}`}>Open</button>
                    <button onClick={() => openEdit(i)} className="text-slate-500 hover:text-[#0F3BE8] p-1.5"><PencilSimple size={16} weight="bold" /></button>
                    <button onClick={() => remove(i.id)} className="text-slate-500 hover:text-red-600 p-1.5"><Trash size={16} weight="bold" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Installation" : "Schedule Installation"} testid="inst-modal">
        <form onSubmit={save} className="space-y-4">
          {!editing && eligibleProjects.length === 0 && (
            <div className="border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3">
              No projects with production complete yet. Production must finish all 8 stages first.
            </div>
          )}
          {!editing && (
            <Field label="Project *">
              <Select required value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} data-testid="inst-input-project">
                <option value="">— Select —</option>
                {eligibleProjects.map((p) => <option key={p.id} value={p.id}>{p.project_no} · {p.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Site Location *"><Textarea required rows={2} value={form.site_location} onChange={(e) => setForm({ ...form, site_location: e.target.value })} data-testid="inst-input-site" /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Installation Date"><Input type="date" value={form.installation_date} onChange={(e) => setForm({ ...form, installation_date: e.target.value })} /></Field>
            <Field label="Team Leader"><Input value={form.team_leader} onChange={(e) => setForm({ ...form, team_leader: e.target.value })} data-testid="inst-input-team" /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={!editing && eligibleProjects.length === 0} data-testid="inst-submit-btn">{editing ? "Update" : "Schedule"}</Btn>
          </div>
        </form>
      </Modal>

      {/* Detail modal: photos, signoff, pdf */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? `${detail.install_no} · ${detail.project_name}` : "Installation"} testid="inst-detail-modal">
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Site</div><div className="text-slate-900">{detail.site_location}</div></div>
              <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Date</div><div className="text-slate-900">{detail.installation_date?.slice(0,10)}</div></div>
              <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Team</div><div className="text-slate-900">{detail.team_leader}</div></div>
              <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Status</div><StatusBadge status={detail.status} /></div>
            </div>

            {["before", "during", "after"].map((bucket) => (
              <div key={bucket}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{bucket} photos</div>
                  <label className="cursor-pointer text-xs text-[#0F3BE8] font-bold uppercase tracking-wider flex items-center gap-1" data-testid={`upload-${bucket}-btn`}>
                    <Camera size={14} weight="bold" /> Upload
                    <input ref={fileRefs[bucket]} type="file" accept="image/*" multiple capture="environment" onChange={(e) => uploadPhotos(bucket, e)} className="hidden" />
                  </label>
                </div>
                <PhotoGrid photos={detail[`${bucket}_photos`]} bucket={bucket} onRemove={removePhoto} />
              </div>
            ))}

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Client Sign-Off</div>
                {!detail.client_signature && (
                  <button onClick={() => setSignOpen(true)} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100" data-testid="open-signoff-btn">
                    <Signature size={12} className="inline mr-1" /> Capture Sign-Off
                  </button>
                )}
              </div>
              {detail.client_signature ? (
                <div className="border border-slate-300 p-3 bg-white">
                  <img src={detail.client_signature} alt="signature" className="h-20 object-contain" />
                  <div className="text-xs text-slate-700 mt-2">
                    Signed by <b>{detail.client_name_signoff}</b> on {new Date(detail.signed_at).toLocaleString("en-IN")}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">Not signed yet</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setDetailOpen(false)}>Close</Btn>
              <Btn variant="accent" onClick={() => generatePDF(detail)} data-testid="pdf-btn"><FilePdf size={14} weight="bold" /> Download Completion Report (PDF)</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Signoff Modal */}
      <Modal open={signOpen} onClose={() => setSignOpen(false)} title="Client Sign-Off" testid="signoff-modal">
        <form onSubmit={submitSignoff} className="space-y-4">
          <Field label="Client Representative Name *">
            <Input required value={signerName} onChange={(e) => setSignerName(e.target.value)} data-testid="signoff-name-input" />
          </Field>
          <Field label="Signature *">
            <SignaturePad onChange={setSignature} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" type="button" onClick={() => setSignOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" data-testid="signoff-submit-btn">Complete & Capture</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
