import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AdmissionOption } from "@/lib/schemas";

const optionSections = [
  { type: "school", title: "Schools", description: "Schools available in student admission.", placeholder: "Add a school name" },
  { type: "group", title: "Academic Groups", description: "Groups available for student records.", placeholder: "Add a group, e.g. Science" },
  { type: "shift", title: "Shifts", description: "Shifts available for student records.", placeholder: "Add a shift, e.g. Morning" },
] as const;

type OptionType = AdmissionOption["type"];

export function AdmissionOptionsManager() {
  const { toast } = useToast();
  const [newNames, setNewNames] = useState<Record<OptionType, string>>({ school: "", group: "", shift: "" });
  const [editing, setEditing] = useState<AdmissionOption | null>(null);
  const [editingName, setEditingName] = useState("");
  const { data: options = [], isLoading } = useQuery<AdmissionOption[]>({
    queryKey: ["/api/admission-options"],
  });

  function refreshOptions() {
    queryClient.invalidateQueries({ queryKey: ["/api/admission-options"] });
  }

  const createOption = useMutation({
    mutationFn: async (data: { type: OptionType; name: string }) => {
      const response = await apiRequest("POST", "/api/admission-options", data);
      return response.json();
    },
    onSuccess: (_created, variables) => {
      setNewNames((current) => ({ ...current, [variables.type]: "" }));
      refreshOptions();
      toast({ title: `${optionSections.find((section) => section.type === variables.type)?.title.slice(0, -1) || "Option"} added` });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not add option", description: error.message }),
  });

  const updateOption = useMutation({
    mutationFn: async ({ id, type, name }: { id: number; type: OptionType; name: string }) => {
      const response = await apiRequest("PATCH", `/api/admission-options/${id}`, { type, name });
      return response.json();
    },
    onSuccess: () => {
      setEditing(null);
      refreshOptions();
      toast({ title: "Option updated" });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not update option", description: error.message }),
  });

  const deleteOption = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admission-options/${id}`);
    },
    onSuccess: () => {
      refreshOptions();
      toast({ title: "Option deleted" });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not delete option", description: error.message }),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {optionSections.map((section) => {
        const sectionOptions = options.filter((option) => option.type === section.type);
        return (
          <Card key={section.type}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newNames[section.type].trim();
                  if (name) createOption.mutate({ type: section.type, name });
                }}
              >
                <Input
                  value={newNames[section.type]}
                  placeholder={section.placeholder}
                  maxLength={100}
                  onChange={(event) => setNewNames((current) => ({
                    ...current,
                    [section.type]: event.target.value,
                  }))}
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label={`Add ${section.type}`}
                  disabled={!newNames[section.type].trim() || createOption.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </form>

              {isLoading ? (
                <p className="py-3 text-sm text-muted-foreground">Loading options…</p>
              ) : sectionOptions.length ? (
                <ul className="divide-y rounded-md border">
                  {sectionOptions.map((option) => (
                    <li key={option.id} className="flex min-h-12 items-center gap-2 px-3 py-2">
                      {editing?.id === option.id ? (
                        <>
                          <Input
                            autoFocus
                            value={editingName}
                            maxLength={100}
                            onChange={(event) => setEditingName(event.target.value)}
                            aria-label={`Edit ${option.name}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Save option"
                            disabled={!editingName.trim() || updateOption.isPending}
                            onClick={() => updateOption.mutate({
                              id: option.id,
                              type: option.type,
                              name: editingName.trim(),
                            })}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Cancel editing"
                            onClick={() => setEditing(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 break-words text-sm font-medium">{option.name}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${option.name}`}
                            onClick={() => {
                              setEditing(option);
                              setEditingName(option.name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Delete ${option.name}`}
                            disabled={deleteOption.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete ${option.name}? Existing student records will keep their saved value.`)) {
                                deleteOption.mutate(option.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-center text-sm text-muted-foreground">No options added yet.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
