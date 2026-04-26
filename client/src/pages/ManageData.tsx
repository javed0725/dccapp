import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useBatches, useStudents, useCreateBatch, useDeleteBatch, useCreateStudent, useDeleteStudent, useUpdateStudent } from "@/hooks/use-finance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Users, Layers, ShieldCheck, Key, UserX, UserCheck, ChevronDown, ChevronRight, Pencil, Phone, UserPlus, Upload, ImageOff } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertBatchSchema, insertStudentSchema, type User, type Student, type Batch } from "@/lib/schemas";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const studentFormSchema = insertStudentSchema.extend({
  batchId: z.coerce.number().min(1, "Select a batch"),
  mobileNumber: z.string().optional(),
  studentCustomId: z.string().min(1, "Student ID is required"),
});

export default function ManageData() {
  const { data: batches } = useBatches();
  const { data: students } = useStudents();
  const { toast } = useToast();

  const createBatch = useCreateBatch();
  const deleteBatch = useDeleteBatch();
  const createStudent = useCreateStudent();
  const deleteStudent = useDeleteStudent();

  const batchForm = useForm<z.infer<typeof insertBatchSchema>>({
    resolver: zodResolver(insertBatchSchema),
    defaultValues: { name: "" },
  });

  const studentForm = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: { name: "", batchId: 0, mobileNumber: "", studentCustomId: "" },
  });

  const updateStudent = useUpdateStudent();
  const [editingStudent, setEditingStudent] = useState<{ 
    id: number; 
    name: string; 
    studentCustomId: string; 
    mobileNumber?: string;
    shift?: string | null;
    academicGroup?: string | null;
  } | null>(null);

  const onBatchSubmit = (values: z.infer<typeof insertBatchSchema>) => {
    createBatch.mutate(values, {
      onSuccess: () => {
        batchForm.reset();
        toast({ title: "Batch added successfully" });
      },
    });
  };

  const onStudentSubmit = (values: z.infer<typeof studentFormSchema>) => {
    createStudent.mutate(values, {
      onSuccess: () => {
        studentForm.reset();
        toast({ title: "Student added successfully" });
      },
    });
  };

  // Teacher Management Logic
  const { data: teachers, isLoading: loadingTeachers } = useQuery<User[]>({
    queryKey: ["/api/admin/teachers"],
  });

  const [teacherId, setTeacherId] = useState("");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherMobile, setTeacherMobile] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");

  const createTeacherMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/teachers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({ title: "Teacher created successfully" });
      setTeacherId("");
      setTeacherUsername("");
      setTeacherPassword("");
      setTeacherMobile("");
      setTeacherName("");
      setTeacherSubject("");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  const [uploadingTeacherId, setUploadingTeacherId] = useState<number | null>(null);

  async function fileToResizedDataUrl(file: File, maxSize = 512, quality = 0.85): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please choose an image file.");
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process the image.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  }

  const updateTeacherMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/admin/teachers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teachers"] });
      toast({ title: "Teacher updated successfully" });
    }
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/teachers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({ title: "Teacher deleted" });
    }
  });

  return (
    <Layout title="Manage Data" subtitle="Configure batches, students, and teachers">
      <Tabs defaultValue="academic" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="academic" className="flex items-center gap-2">
            <Layers className="w-4 h-4" /> Academic Data
          </TabsTrigger>
          <TabsTrigger value="teachers" className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Teacher Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="academic">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Add New Batch
                  </CardTitle>
                  <CardDescription>Create a new group for students</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...batchForm}>
                    <form onSubmit={batchForm.handleSubmit(onBatchSubmit)} className="flex gap-4">
                      <FormField
                        control={batchForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="e.g. HSC 2026" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={createBatch.isPending}>
                        <Plus className="w-4 h-4 mr-2" /> Add
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Batches List</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch Name</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches?.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">{batch.name}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm("Delete this batch?")) {
                                  deleteBatch.mutate(batch.id, {
                                    onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                                  });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Students List</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {batches?.map((batch) => {
                      const batchStudents = (students?.filter(s => s.batchId === batch.id) || []).sort((a, b) => parseInt(a.studentCustomId || '0') - parseInt(b.studentCustomId || '0'));
                      return (
                        <AccordionItem value={`batch-${batch.id}`} key={batch.id} className="border-b-0 mb-4">
                          <AccordionTrigger className="hover:no-underline py-2 px-4 bg-muted/50 rounded-lg group">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary">{batch.name}</span>
                              <span className="text-xs text-muted-foreground font-normal">
                                ({batchStudents.length} students)
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2">
                            <Table>
                              <TableBody>
                                {batchStudents.length === 0 ? (
                                  <TableRow>
                                    <TableCell className="text-center py-4 text-muted-foreground italic">No students in this batch</TableCell>
                                  </TableRow>
                                ) : (
                                  batchStudents.map((student) => (
                                    <TableRow key={student.id} className="group hover:bg-muted/30">
                                      
                                      <TableCell className="font-medium">
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2">
                                            {student.name}
                                            {!student.studentCustomId && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-tighter ring-1 ring-amber-200">
                                                ID Pending
                                              </span>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                              onClick={() => setEditingStudent({ 
                                                id: student.id, 
                                                name: student.name,
                                                studentCustomId: student.studentCustomId || "",
                                                mobileNumber: student.mobileNumber || "",
                                                shift: student.shift || "",
                                                academicGroup: student.academicGroup || ""
                                              })}
                                            >
                                              <Pencil className="w-3 h-3 text-muted-foreground" />
                                            </Button>
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
                                            {student.studentCustomId ? (
                                              <span>ID: {student.studentCustomId}</span>
                                            ) : (
                                              <span className="text-amber-600 font-medium">No ID Assigned</span>
                                            )}
                                            {student.mobileNumber && (
                                              <>
                                                <span>•</span>
                                                <a
                                                  href={`tel:${student.mobileNumber}`}
                                                  data-testid={`quick-call-manage-${student.id}`}
                                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 active:text-blue-800 transition-colors"
                                                  title={`Call ${student.name}`}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <Phone className="w-3.5 h-3.5 shrink-0" />
                                                  <span>{student.mobileNumber}</span>
                                                </a>
                                              </>
                                            )}
                                            {student.shift && (
                                              <>
                                                <span>•</span>
                                                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">{student.shift}</span>
                                              </>
                                            )}
                                            {student.academicGroup && (
                                              <>
                                                <span>•</span>
                                                <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">{student.academicGroup}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </TableCell>
                                        
                                      <TableCell className="w-[100px] text-right space-x-2">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-destructive h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => {
                                            if (confirm("Delete this student?")) {
                                              deleteStudent.mutate(student.id);
                                            }
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>

                  <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Edit Student Info</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Student ID</label>
                          <Input
                            value={editingStudent?.studentCustomId || ""}
                            onChange={(e) => setEditingStudent(prev => prev ? { ...prev, studentCustomId: e.target.value } : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Name</label>
                          <Input
                            value={editingStudent?.name || ""}
                            onChange={(e) => setEditingStudent(prev => prev ? { ...prev, name: e.target.value } : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Mobile Number</label>
                          <Input
                            placeholder="Enter number"
                            value={editingStudent?.mobileNumber || ""}
                            onChange={(e) => setEditingStudent(prev => prev ? { ...prev, mobileNumber: e.target.value } : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Shift</label>
                          <Select 
                            value={editingStudent?.shift || "none"} 
                            onValueChange={(val) => setEditingStudent(prev => prev ? { ...prev, shift: val === "none" ? null : val } : null)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Shift (Optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="Morning">Morning</SelectItem>
                              <SelectItem value="Evening">Evening</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Academic Group</label>
                          <Select 
                            value={editingStudent?.academicGroup || "none"} 
                            onValueChange={(val) => setEditingStudent(prev => prev ? { ...prev, academicGroup: val === "none" ? null : val } : null)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Group (Optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="Science">Science</SelectItem>
                              <SelectItem value="Commerce">Commerce</SelectItem>
                              <SelectItem value="Arts">Arts</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setEditingStudent(null)}>Cancel</Button>
                        <Button
                          disabled={updateStudent.isPending}
                          onClick={() => {
                            if (editingStudent) {
                              updateStudent.mutate({ 
                                id: editingStudent.id, 
                                data: { 
                                  name: editingStudent.name, 
                                  studentCustomId: editingStudent.studentCustomId,
                                  mobileNumber: editingStudent.mobileNumber,
                                  shift: editingStudent.shift,
                                  academicGroup: editingStudent.academicGroup
                                } 
                              }, {
                                onSuccess: () => {
                                  setEditingStudent(null);
                                  toast({ title: "Updated successfully" });
                                }
                              });
                            }
                          }}
                        >
                          {updateStudent.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teachers">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Add New Teacher
                </CardTitle>
                <CardDescription>Assign ID and credentials</CardDescription>
              </CardHeader>
              <CardContent>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    createTeacherMutation.mutate({ 
                      teacherId, 
                      username: teacherUsername, 
                      password: teacherPassword,
                      mobileNumber: teacherMobile || undefined,
                      name: teacherName || undefined,
                      subject: teacherSubject || undefined,
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Teacher ID (e.g. T101)</label>
                    <Input 
                      placeholder="Enter unique ID" 
                      value={teacherId}
                      onChange={(e) => setTeacherId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Login Username</label>
                    <Input 
                      placeholder="Used to log in" 
                      value={teacherUsername}
                      onChange={(e) => setTeacherUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Display Name <span className="text-muted-foreground font-normal">(shown on website)</span></label>
                    <Input 
                      placeholder="e.g. Md. Rahim Uddin" 
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Subject <span className="text-muted-foreground font-normal">(shown on website)</span></label>
                    <Input 
                      placeholder="e.g. Mathematics, Physics" 
                      value={teacherSubject}
                      onChange={(e) => setTeacherSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Default Password</label>
                    <Input 
                      type="password"
                      placeholder="Set password" 
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Mobile Number</label>
                    <Input 
                      type="tel"
                      placeholder="e.g. 01700000000" 
                      value={teacherMobile}
                      onChange={(e) => setTeacherMobile(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="submit"
                    className="w-full" 
                    disabled={createTeacherMutation.isPending || !teacherId || !teacherUsername || !teacherPassword}
                  >
                    {createTeacherMutation.isPending ? "Creating..." : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Teacher Accounts
                </CardTitle>
                <CardDescription>Manage teacher access and credentials</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Photo</TableHead>
                      <TableHead>Teacher ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTeachers ? (
                      <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
                    ) : [...(teachers || [])].sort((a, b) => parseInt((a as any).teacherId || '0') - parseInt((b as any).teacherId || '0')).map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {teacher.imageUrl ? (
                              <img
                                src={teacher.imageUrl}
                                alt={teacher.name || teacher.username}
                                data-testid={`img-teacher-thumb-${teacher.id}`}
                                className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                <ImageOff className="w-4 h-4" />
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <label
                                className="cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                data-testid={`label-upload-teacher-${teacher.id}`}
                              >
                                <Upload className="w-3 h-3" />
                                {uploadingTeacherId === teacher.id ? "Uploading…" : (teacher.imageUrl ? "Replace" : "Upload")}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  data-testid={`input-upload-teacher-${teacher.id}`}
                                  disabled={uploadingTeacherId !== null}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file) return;
                                    try {
                                      setUploadingTeacherId(teacher.id);
                                      const dataUrl = await fileToResizedDataUrl(file);
                                      await new Promise<void>((resolve, reject) => {
                                        updateTeacherMutation.mutate(
                                          { id: teacher.id, data: { imageUrl: dataUrl } },
                                          { onSuccess: () => resolve(), onError: (err) => reject(err) },
                                        );
                                      });
                                    } catch (err: any) {
                                      toast({
                                        variant: "destructive",
                                        title: "Upload failed",
                                        description: err?.message || "Could not upload the image.",
                                      });
                                    } finally {
                                      setUploadingTeacherId(null);
                                    }
                                  }}
                                />
                              </label>
                              {teacher.imageUrl && (
                                <button
                                  type="button"
                                  data-testid={`button-remove-teacher-image-${teacher.id}`}
                                  className="text-xs text-destructive hover:underline text-left"
                                  disabled={uploadingTeacherId !== null}
                                  onClick={() => {
                                    if (confirm(`Remove photo for ${teacher.name || teacher.username}?`)) {
                                      updateTeacherMutation.mutate({ id: teacher.id, data: { imageUrl: null } });
                                    }
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-primary">{teacher.teacherId ?? "—"}</TableCell>
                        <TableCell className="font-medium">{teacher.username}</TableCell>
                        <TableCell className="text-slate-700">{(teacher as any).name ?? <span className="text-muted-foreground text-xs">Not set</span>}</TableCell>
                        <TableCell className="text-slate-700">{(teacher as any).subject ?? <span className="text-muted-foreground text-xs">Not set</span>}</TableCell>
                        <TableCell className="text-slate-500 text-sm">{teacher.mobileNumber ?? "—"}</TableCell>
                        <TableCell>
                          {teacher.role === "teacher" ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                              <UserCheck className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground text-xs font-bold">
                              <UserX className="w-3 h-3" /> Deactivated
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              const newPass = prompt("Enter new password for " + teacher.username);
                              if (newPass) {
                                updateTeacherMutation.mutate({ id: teacher.id, data: { password: newPass } });
                              }
                            }}
                          >
                            <Key className="w-3 h-3 mr-1" /> Reset Pass
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              const newRole = teacher.role === "teacher" ? "deactivated" : "teacher";
                              updateTeacherMutation.mutate({ id: teacher.id, data: { role: newRole } });
                            }}
                          >
                            {teacher.role === "teacher" ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-8 w-8"
                            onClick={() => {
                              if (confirm(`Delete teacher ${teacher.username} permanently?`)) {
                                deleteTeacherMutation.mutate(teacher.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {teachers?.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No teachers registered.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
