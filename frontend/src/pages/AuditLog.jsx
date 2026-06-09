import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Empty } from "@/components/Bits";
import { Clock, User as UserIcon } from "@phosphor-icons/react";

export default function AuditLog() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/audit-log", { params: { limit: 300 } }).then((r) => setList(r.data)); }, []);

  return (
    <div className="p-6 lg:p-8" data-testid="audit-log-page">
      <PageHeader subtitle="Compliance" title="Audit Log" />
      <div className="lumia-surface overflow-x-auto">
        {list.length === 0 ? <Empty title="No activity recorded yet" note="Mutating actions across modules will appear here." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="text-left px-4 py-2 font-semibold">When</th>
              <th className="text-left px-4 py-2 font-semibold">User</th>
              <th className="text-left px-4 py-2 font-semibold">Role</th>
              <th className="text-left px-4 py-2 font-semibold">Module</th>
              <th className="text-left px-4 py-2 font-semibold">Action</th>
            </tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-t border-slate-200 hover:bg-slate-50" data-testid={`audit-row-${a.id}`}>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(a.created_at).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 font-semibold">{a.user_name}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider text-slate-600">{a.user_role}</td>
                  <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border border-slate-300 bg-slate-50 text-slate-700">{a.module}</span></td>
                  <td className="px-4 py-3 text-slate-800">{a.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
