import "./_group.css";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, Pencil, Send, Trash2, Users } from "lucide-react";

const drafts = [
  { name: "Preparatory Exam 2026", group: "All Groups + Arts", status: "Draft", subjects: 6, students: 42 },
  { name: "Preparatory Exam 2026", group: "All Groups + Commerce", status: "Published", subjects: 6, students: 38 },
];

export function MobileFriendly() {
  return (
    <div className="authority-draft-preview dark min-h-screen bg-background p-3 text-foreground sm:p-5">
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="pb-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Active &amp; Published Drafts
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Manage exam drafts and published results</p>
        </div>
        {drafts.map((draft) => (
          <Card
            key={draft.group}
            className={`overflow-hidden border bg-card/90 shadow-sm ${
              draft.status === "Published" ? "border-emerald-500/30" : "border-border"
            }`}
          >
            <CardHeader className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <button className="group flex min-w-0 flex-1 items-start justify-between gap-2 text-left">
                  <CardTitle className="min-w-0 break-words text-base font-bold leading-snug [overflow-wrap:anywhere] group-hover:text-primary sm:text-lg">
                    {draft.name}
                  </CardTitle>
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={draft.status === "Published" ? "bg-emerald-600 text-white" : "bg-amber-400 text-slate-950"}>
                    {draft.status}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${draft.name} for ${draft.group}`}
                    title="Delete draft"
                    className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metadata label="Class" value="Class 9" />
                <Metadata label="Academic group" value={draft.group} icon />
                <Metadata label="Subjects" value={`${draft.subjects} subjects`} />
                <Metadata label="Students" value={`${draft.students} students`} />
              </div>

              <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row">
                <Button type="button" variant="outline" className="min-h-10 w-full justify-center gap-2 sm:flex-1">
                  <Pencil className="h-4 w-4" /> Edit Draft
                </Button>
                {draft.status === "Draft" && (
                  <Button type="button" className="min-h-10 w-full justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 sm:flex-1">
                    <Send className="h-4 w-4" /> Publish Result
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metadata({ label, value, icon = false }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs font-medium leading-snug text-foreground sm:text-sm">
        {icon && <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{value}</span>
      </p>
    </div>
  );
}
