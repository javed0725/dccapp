import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useBatches, useStudents } from "@/hooks/use-finance";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Search, BookUser, Users } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function StudentDirectory() {
  const [query, setQuery] = useState("");

  const { data: studentsRaw, isLoading } = useStudents();
  const { data: batches } = useBatches();

  // Only active students
  const allActive = ((studentsRaw as any[] | undefined) ?? [])
    .filter((s: any) => s.isActive !== false)
    .sort((a: any, b: any) => parseInt(a.studentCustomId || "0") - parseInt(b.studentCustomId || "0"));

  // Search filter — name, ID, or phone
  const q = query.trim().toLowerCase();
  const filtered = q
    ? allActive.filter((s: any) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.studentCustomId ?? "").toLowerCase().includes(q) ||
        (s.mobileNumber ?? "").toLowerCase().includes(q)
      )
    : allActive;

  // Group by batch
  const byBatch: Record<string, any[]> = {};
  for (const s of filtered) {
    const key = s.batch?.name ?? "Unknown";
    if (!byBatch[key]) byBatch[key] = [];
    byBatch[key].push(s);
  }

  // Sort batch names (keep "Unknown" last)
  const batchOrder = (batches as any[] | undefined)?.map((b: any) => b.name) ?? [];
  const sortedBatchKeys = Object.keys(byBatch).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    const ai = batchOrder.indexOf(a);
    const bi = batchOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <Layout title="Student Directory" subtitle="View-only directory of all active students">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header stats */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-blue-400" />
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center shrink-0">
              <BookUser className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 leading-none mb-1">
                Student Directory
              </h2>
              <p className="text-xs text-muted-foreground">Active students only · View-only access</p>
            </div>
            <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-full px-3 py-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{allActive.length}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm"
            placeholder="Search by name, ID, or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading students…</div>
        )}

        {/* No results */}
        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {q ? "No students match your search." : "No active students found."}
          </div>
        )}

        {/* Batch accordions */}
        {!isLoading && filtered.length > 0 && (
          <Accordion type="multiple" defaultValue={sortedBatchKeys} className="space-y-3">
            {sortedBatchKeys.map((batchName) => {
              const students = byBatch[batchName];
              return (
                <AccordionItem
                  key={batchName}
                  value={batchName}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-[0_2px_12px_-3px_rgba(0,0,0,0.06)]"
                >
                  <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 [&[data-state=open]]:bg-slate-50 dark:[&[data-state=open]]:bg-slate-800/30">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{batchName}</span>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-bold">
                        {students.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="p-0">
                    <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
                      {students.map((s: any) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          {/* Avatar initial */}
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase">
                            {(s.name ?? "?").charAt(0)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-snug">
                              {s.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              {s.studentCustomId ? (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                  {s.studentCustomId}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tight">No ID</span>
                              )}
                              {s.shift && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-600">•</span>
                                  <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">
                                    {s.shift}
                                  </span>
                                </>
                              )}
                              {s.academicGroup && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-600">•</span>
                                  <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">
                                    {s.academicGroup}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Phone — clickable call link */}
                          {s.mobileNumber ? (
                            <a
                              href={`tel:${s.mobileNumber}`}
                              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 active:text-blue-800 transition-colors shrink-0 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-800 rounded-xl px-2.5 py-1.5"
                              title={`Call ${s.name}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-[11px] font-semibold hidden sm:inline">{s.mobileNumber}</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-300 dark:text-slate-600 shrink-0 italic">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

      </div>
    </Layout>
  );
}
