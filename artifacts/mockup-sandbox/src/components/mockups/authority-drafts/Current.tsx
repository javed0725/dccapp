import "./_group.css";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ClipboardList, Pencil, Send, Trash2 } from "lucide-react";

const drafts = [
  { name: "Preparatory Exam 2026", group: "All Groups + Arts", status: "Draft", subjects: 6, students: 42 },
  { name: "Preparatory Exam 2026", group: "All Groups + Commerce", status: "Published", subjects: 6, students: 38 },
];

export function Current() {
  return (
    <div className="authority-draft-preview dark min-h-screen bg-background p-3 text-foreground">
      <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Active &amp; Published Drafts
        </p>
        {drafts.map((draft) => (
          <Card key={draft.group} className="overflow-hidden border-2 border-slate-200 bg-slate-950/50">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button className="group flex min-w-0 flex-1 items-center gap-2 text-left">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-bold leading-snug group-hover:text-primary">
                      {draft.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Class 9 · {draft.group} · {draft.subjects} subjects · {draft.students} students
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={draft.status === "Published" ? "bg-green-500 text-white" : "bg-amber-400 text-white"}>
                    {draft.status}
                  </Badge>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit Draft
                  </Button>
                  {draft.status === "Draft" && (
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700">
                      <Send className="h-3.5 w-3.5" /> Publish Result
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          Current layout from the Authority results page
        </div>
      </div>
    </div>
  );
}
