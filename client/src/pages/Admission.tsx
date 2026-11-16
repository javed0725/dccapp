import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useBatches, useCreateStudent, useStudents, useUpdateStudent } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertStudentSchema } from "@/lib/schemas";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, CheckCircle2, GraduationCap, RefreshCw, Phone, BadgeCheck, Users, Printer } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { type AdmissionOption, type User } from "@/lib/schemas";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const studentFormSchema = insertStudentSchema.extend({
  batchId: z.coerce.number().min(1, "Select a batch"),
  mobileNumber: z.string().optional(),
});

type AdmissionReceiptData = {
  id: number;
  studentCustomId: string | null;
  name: string;
  batchName: string;
  school: string | null;
  academicGroup: string | null;
  shift: string | null;
  admissionDate: string | null;
  admittingTeacher: string;
};

function formatAdmissionDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Admission() {
  const [open, setOpen] = useState(false);
  const [admittedStudent, setAdmittedStudent] = useState<AdmissionReceiptData | null>(null);
  const [selectedExistingStudentId, setSelectedExistingStudentId] = useState<number | null>(null);
  const [admittingTeacherIsSelf, setAdmittingTeacherIsSelf] = useState(true);
  const [admittingTeacherId, setAdmittingTeacherId] = useState("");
  const { data: batches } = useBatches();
  const { data: students, refetch: refetchStudents } = useStudents();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const { toast } = useToast();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: admissionTeachers = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/payment-teachers"],
    enabled: user?.role === "teacher",
  });

  useEffect(() => {
    if (admittingTeacherIsSelf && user?.id) {
      setAdmittingTeacherId(String(user.id));
    }
  }, [admittingTeacherIsSelf, user?.id]);

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: { name: "", batchId: 0, mobileNumber: "", studentCustomId: "", school: "", academicGroup: "", shift: "" },
  });

  const { data: admissionOptions = [] } = useQuery<AdmissionOption[]>({
    queryKey: ["/api/admission-options"],
    enabled: isTeacher,
  });
  const selectedBatchId = Number(form.watch("batchId"));
  const studentNameQuery = String(form.watch("name") || "").trim().toLocaleLowerCase();
  const existingStudentSuggestions = selectedBatchId > 0 && studentNameQuery
    ? ((students as any[] | undefined) ?? [])
      .filter((student) =>
        Number(student.batchId) === selectedBatchId &&
        String(student.name || "").toLocaleLowerCase().includes(studentNameQuery),
      )
      .slice(0, 6)
    : [];
  const schoolOptions = admissionOptions.filter((option) => option.type === "school");
  const groupOptions = admissionOptions.filter((option) => option.type === "group");
  const shiftOptions = admissionOptions.filter((option) => option.type === "shift");

  useEffect(() => {
    if (!admittedStudent) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [admittedStudent]);

  function onSubmit(values: z.infer<typeof studentFormSchema>) {
    const selectedAdmittingTeacher = admissionTeachers.find(
      (teacher) => String(teacher.id) === admittingTeacherId,
    );
    if (!selectedAdmittingTeacher) {
      toast({
        variant: "destructive",
        title: "Select an admitting teacher",
        description: "Choose yourself or select the teacher who processed this admission.",
      });
      return;
    }
    const reAdmission = selectedExistingStudentId !== null;
    const selectedStudent = ((students as any[] | undefined) ?? [])
      .find((student) => student.id === selectedExistingStudentId);
    const submittedValues = {
      ...values,
      name: values.name.trim(),
      mobileNumber: values.mobileNumber?.trim() || null,
      school: values.school?.trim() || "",
      studentCustomId: values.studentCustomId?.trim() || (reAdmission ? selectedStudent?.studentCustomId : null) || null,
      academicGroup: values.academicGroup?.trim() || "",
      shift: values.shift?.trim() || "",
    };

    const handleSuccess = (student: any) => {
        setOpen(false);
        form.reset();
        setSelectedExistingStudentId(null);
        setAdmittingTeacherIsSelf(true);
        setAdmittingTeacherId(user?.id ? String(user.id) : "");
        queryClient.invalidateQueries({ queryKey: ["/api/students"] });
        queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
        const batch = ((batches as any[] | undefined) ?? []).find((item) => item.id === student.batchId);
        setAdmittedStudent({
          id: student.id,
          studentCustomId: student.studentCustomId ?? null,
          name: student.name,
          batchName: batch?.name ?? `Class ${student.batchId}`,
          school: student.school || null,
          academicGroup: student.academicGroup || null,
          shift: student.shift || null,
          admissionDate: reAdmission ? new Date().toISOString() : student.admissionDate ?? new Date().toISOString(),
          admittingTeacher: selectedAdmittingTeacher.name,
        });
        toast({
          title: "Success",
          description: reAdmission ? "Student has been re-admitted successfully." : "Student has been admitted successfully.",
        });
    };
    const handleError = (error: any) => {
      toast({ variant: "destructive", title: "Admission Failed", description: error.message });
    };

    if (selectedExistingStudentId !== null) {
      updateStudent.mutate({
        id: selectedExistingStudentId,
        data: { ...submittedValues, isActive: true },
      }, { onSuccess: handleSuccess, onError: handleError });
      return;
    }
    createStudent.mutate(submittedValues, { onSuccess: handleSuccess, onError: handleError });
  }

  function selectExistingStudent(student: any) {
    setSelectedExistingStudentId(student.id);
    form.setValue("name", student.name ?? "");
    form.setValue("studentCustomId", student.studentCustomId ?? "");
    form.setValue("mobileNumber", student.mobileNumber ?? "");
    form.setValue("school", student.school ?? "");
    form.setValue("academicGroup", student.academicGroup ?? "");
    form.setValue("shift", student.shift ?? "");
  }

  // Build admission list data
  const myStudents = isTeacher
    ? ((students as any[] | undefined)?.filter((s: any) => s.addedByUserId === (user as any)?.id) ?? []).sort((a: any, b: any) => parseInt(a.studentCustomId || '0') - parseInt(b.studentCustomId || '0'))
    : [];

  const allStudents = isAdmin
    ? ((students as any[] | undefined) ?? []).sort((a: any, b: any) => parseInt(a.studentCustomId || '0') - parseInt(b.studentCustomId || '0'))
    : [];

  // Group teacher's own students by batch
  const myStudentsByBatch: Record<string, any[]> = {};
  for (const s of myStudents) {
    const batchName = s.batch?.name ?? "Unknown";
    if (!myStudentsByBatch[batchName]) myStudentsByBatch[batchName] = [];
    myStudentsByBatch[batchName].push(s);
  }

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd MMM yyyy"); } catch { return "—"; }
  };

  const teacherDisplayId = user?.teacherId ?? `T-${String(user?.id ?? "").padStart(3, "0")}`;

  return (
    <Layout
      title={isAdmin ? "Admission Records" : "Home"}
      subtitle={isAdmin ? "All student admissions across all teachers" : "Your profile and admission management"}
    >
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── TEACHER PROFILE CARD ── */}
        {isTeacher && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden">
            {/* Coloured accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-blue-400" />
            <div className="p-5 flex items-center gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center shrink-0">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-200 leading-none mb-1 capitalize">
                  {user?.username}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <BadgeCheck className="w-3.5 h-3.5 text-indigo-400" />
                    {teacherDisplayId}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                    {user?.mobileNumber ?? "Not set"}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    {myStudents.length} student{myStudents.length !== 1 ? "s" : ""} admitted
                  </span>
                </div>
              </div>
              {/* Role badge */}
              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 px-3 py-1.5 rounded-full">
                Teacher
              </span>
            </div>
          </div>
        )}

        {/* ── ADMISSION CARD (teacher only) ── */}
        {isTeacher && (
          <>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">New Admission</h2>
                <p className="text-muted-foreground">Fill in student details to enroll them in a batch.</p>
              </div>

              <Dialog
                open={open}
                onOpenChange={(isOpen) => {
                  setOpen(isOpen);
                  if (!isOpen) {
                    form.reset();
                    setSelectedExistingStudentId(null);
                    setAdmittingTeacherIsSelf(true);
                    setAdmittingTeacherId(user?.id ? String(user.id) : "");
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full shadow-lg hover:shadow-xl transition-all h-12 text-lg">
                    Start Admission Process
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Student Admission Form</DialogTitle>
                    <DialogDescription>Enter the student's information below.</DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="batchId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Class/Batch</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                setSelectedExistingStudentId(null);
                                form.setValue("name", "");
                                form.setValue("studentCustomId", "");
                                form.setValue("mobileNumber", "");
                                form.setValue("school", "");
                                form.setValue("academicGroup", "");
                                form.setValue("shift", "");
                              }}
                              value={field.value ? field.value.toString() : ""}
                            >
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(batches as any[])?.map((batch) => (
                                  <SelectItem key={batch.id} value={batch.id.toString()}>{batch.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student Name</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  placeholder={selectedBatchId ? "Type a name to search this class" : "Select a class first"}
                                  autoComplete="off"
                                  disabled={!selectedBatchId}
                                  {...field}
                                  onChange={(event) => {
                                    field.onChange(event);
                                    setSelectedExistingStudentId(null);
                                  }}
                                />
                              </FormControl>
                              {studentNameQuery && selectedBatchId > 0 && selectedExistingStudentId === null && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
                                  {existingStudentSuggestions.length > 0 ? existingStudentSuggestions.map((student: any) => (
                                    <button
                                      key={student.id}
                                      type="button"
                                      className="flex w-full flex-col items-start rounded-sm px-3 py-2 text-left hover:bg-accent"
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        selectExistingStudent(student);
                                      }}
                                    >
                                      <span className="font-medium">{student.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        ID {student.studentCustomId || student.id}
                                        {student.academicGroup ? ` · ${student.academicGroup}` : ""}
                                        {student.shift ? ` · ${student.shift}` : ""}
                                        {student.isActive === false ? " · Inactive" : ""}
                                      </span>
                                    </button>
                                  )) : (
                                    <p className="px-3 py-2 text-sm text-muted-foreground">No matching student in this class. Continue with manual entry.</p>
                                  )}
                                </div>
                              )}
                            </div>
                            {selectedExistingStudentId !== null && (
                              <p className="text-xs text-primary">Existing student selected. Confirming will update and reactivate this record.</p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="studentCustomId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student ID / Registration Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Optional"
                                {...field}
                                value={field.value ?? ""}
                                readOnly={selectedExistingStudentId !== null}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="mobileNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile Number</FormLabel>
                            <FormControl><Input type="tel" placeholder="Optional · e.g. 01700000000" {...field} value={field.value ?? ""} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="school"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>School (Optional)</FormLabel>
                            <Select
                              value={field.value || "none"}
                              onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                            >
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No school selected</SelectItem>
                                {field.value && !schoolOptions.some((option) => option.name === field.value) && (
                                  <SelectItem value={field.value}>{field.value} (saved)</SelectItem>
                                )}
                                {schoolOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="academicGroup"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Academic Group</FormLabel>
                              <Select
                                value={field.value || "none"}
                                onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                                disabled={groupOptions.length === 0}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder={groupOptions.length ? "Select a group" : "No groups set"} /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">No group</SelectItem>
                                  {field.value && !groupOptions.some((option) => option.name === field.value) && (
                                    <SelectItem value={field.value}>{field.value} (saved)</SelectItem>
                                  )}
                                  {groupOptions.map((option) => <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="shift"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Shift (Optional)</FormLabel>
                              <Select
                                value={field.value || "none"}
                                onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Select a shift" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">No shift selected</SelectItem>
                                  {field.value && !shiftOptions.some((option) => option.name === field.value) && (
                                    <SelectItem value={field.value}>{field.value} (saved)</SelectItem>
                                  )}
                                  {shiftOptions.map((option) => <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormItem>
                        <div className="flex items-center justify-between gap-3">
                          <FormLabel>Admitting Teacher</FormLabel>
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                            <Checkbox
                              checked={admittingTeacherIsSelf}
                              onCheckedChange={(checked) => {
                                const isSelf = checked === true;
                                setAdmittingTeacherIsSelf(isSelf);
                                setAdmittingTeacherId(isSelf && user?.id ? String(user.id) : "");
                              }}
                            />
                            Self
                          </label>
                        </div>
                        <Select
                          value={admittingTeacherId}
                          onValueChange={setAdmittingTeacherId}
                          disabled={admittingTeacherIsSelf}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select the admitting teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {admissionTeachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={String(teacher.id)}>
                                {teacher.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!admittingTeacherIsSelf && !admittingTeacherId && (
                          <p className="text-sm text-destructive">Select who processed this admission.</p>
                        )}
                      </FormItem>
                      <Button type="submit" className="w-full h-11" disabled={createStudent.isPending || updateStudent.isPending}>
                        {createStudent.isPending || updateStudent.isPending
                          ? "Processing..."
                          : selectedExistingStudentId !== null ? "Confirm Re-admission" : "Confirm Admission"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 font-medium leading-relaxed">
                Students added here will immediately appear in the payment list and administrative records.
              </p>
            </div>
          </>
        )}

        {/* ── TEACHER: My Admissions ── */}
        {isTeacher && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">My Admissions</h3>
                  <p className="text-xs text-muted-foreground">Students you have enrolled</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{myStudents.length} student{myStudents.length !== 1 ? "s" : ""}</Badge>
                <Button variant="outline" size="sm" className="gap-1.5 text-slate-600 dark:text-slate-400 h-8" onClick={() => refetchStudents()}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </div>
            </div>

            {myStudents.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                You haven't admitted any students yet.
              </div>
            ) : (
              <div className="p-4">
                <Accordion type="multiple" className="space-y-2">
                  {Object.entries(myStudentsByBatch).map(([batchName, batchStudents]) => (
                    <AccordionItem
                      key={batchName}
                      value={batchName}
                      className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 [&[data-state=open]]:bg-slate-50 dark:[&[data-state=open]]:bg-slate-800/50">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{batchName}</span>
                          <Badge variant="secondary" className="text-xs">{batchStudents.length} student{batchStudents.length !== 1 ? "s" : ""}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-0 pb-0">
                        <div className="border-t border-slate-100 dark:border-slate-800">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                <th className="px-4 py-2 text-left font-medium">Name</th>
                                <th className="px-4 py-2 text-left font-medium">ID</th>
                                <th className="px-4 py-2 text-left font-medium">Class</th>
                                <th className="px-4 py-2 text-left font-medium">Admitted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchStudents.map((s: any) => (
                                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{s.name}</td>
                                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{s.studentCustomId ?? "—"}</td>
                                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{s.batch?.name ?? "—"}</td>
                                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{formatDate(s.admissionDate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN: All Admitted Students ── */}
        {isAdmin && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">All Admitted Students</h3>
                  <p className="text-xs text-muted-foreground">Complete admission records across all teachers</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{allStudents.length} total</Badge>
                <Button variant="outline" size="sm" className="gap-1.5 text-slate-600 dark:text-slate-400 h-8" onClick={() => refetchStudents()}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </div>
            </div>

            {allStudents.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No students have been admitted yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">ID</th>
                      <th className="px-4 py-3 text-left font-medium">Class</th>
                      <th className="px-4 py-3 text-left font-medium">Phone</th>
                      <th className="px-4 py-3 text-left font-medium">Admitted By</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStudents.map((s: any) => (
                      <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{s.name}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{s.studentCustomId ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{s.batch?.name ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {s.mobileNumber ? (
                            <a
                              href={`tel:${s.mobileNumber}`}
                              data-testid={`quick-call-admin-${s.id}`}
                              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 active:text-blue-800 transition-colors"
                              title={`Call ${s.name}`}
                            >
                              <Phone className="w-5 h-5 shrink-0" />
                              <span className="text-xs font-medium">{s.mobileNumber}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {s.addedByUser ? (
                            <span className="inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-medium">
                              <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                {s.addedByUser.username?.charAt(0)?.toUpperCase()}
                              </span>
                              {s.addedByUser.username}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Not recorded</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{formatDate(s.admissionDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <Dialog
          open={Boolean(admittedStudent)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setAdmittedStudent(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                Admission completed
              </DialogTitle>
              <DialogDescription>
                The A5 office and applicant copies are ready. The print dialog was opened automatically.
              </DialogDescription>
            </DialogHeader>
            {admittedStudent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Student</p><p className="font-semibold">{admittedStudent.name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Registration</p><p className="font-semibold">{admittedStudent.studentCustomId || admittedStudent.id}</p></div>
                  <div><p className="text-xs text-muted-foreground">Class / Group</p><p className="font-semibold">{admittedStudent.batchName} · {admittedStudent.academicGroup || "No group"}</p></div>
                  <div><p className="text-xs text-muted-foreground">School</p><p className="font-semibold">{admittedStudent.school || "Not specified"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Shift</p><p className="font-semibold">{admittedStudent.shift || "Not specified"}</p></div>
                </div>
                <Button onClick={() => window.print()} className="w-full gap-2">
                  <Printer className="h-4 w-4" />
                  Print Admission Receipt
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {admittedStudent && (
          <article id="admission-receipt-print" aria-label="Admission receipt">
            {(["Office Copy", "Applicant Copy"] as const).map((copy, index) => (
              <section className="admission-receipt-copy" key={copy}>
                <header className="admission-receipt-header">
                  <h1>Dynamic Coaching Center</h1>
                  <p>STUDENT ADMISSION RECEIPT</p>
                  <strong>{copy}</strong>
                </header>
                <div className="admission-receipt-details">
                  <div><span>Student Name</span><strong>{admittedStudent.name}</strong></div>
                  <div>
                    <span>Student ID / Registration Number</span>
                    <strong>{admittedStudent.studentCustomId || admittedStudent.id}</strong>
                  </div>
                  <div><span>Class</span><strong>{admittedStudent.batchName}</strong></div>
                  <div><span>School</span><strong>{admittedStudent.school || "Not specified"}</strong></div>
                  <div><span>Group</span><strong>{admittedStudent.academicGroup || "Not specified"}</strong></div>
                  <div><span>Shift / Batch</span><strong>{admittedStudent.shift || "Not specified"} · {admittedStudent.batchName}</strong></div>
                  <div><span>Admission Date &amp; Time</span><strong>{formatAdmissionDateTime(admittedStudent.admissionDate)}</strong></div>
                  <div className="admission-receipt-teacher">
                    <span>Admitting Teacher</span><strong>{admittedStudent.admittingTeacher}</strong>
                  </div>
                </div>
                {index === 0 && (
                  <div className="admission-receipt-cutline">
                    <span>CUT HERE</span>
                  </div>
                )}
              </section>
            ))}
          </article>
        )}
      </div>
      <style>{`
        #admission-receipt-print { display: none; }
        @media print {
          @page { size: A5 portrait; margin: 7mm; }
          html, body, #root { width: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #admission-receipt-print, #admission-receipt-print * { visibility: visible !important; }
          #admission-receipt-print {
            display: block !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            color: #172033 !important;
            background: #fff !important;
            font-family: Arial, sans-serif !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .admission-receipt-copy { position: relative; height: 94mm; box-sizing: border-box; padding: 3mm 4mm 5mm; page-break-inside: avoid; }
          .admission-receipt-header { text-align: center; border-bottom: 1.5px solid #243b63; padding-bottom: 2.5mm; }
          .admission-receipt-header h1 { margin: 0; color: #182b4b; font-size: 14pt; line-height: 1.15; }
          .admission-receipt-header p { margin: 1mm 0 1.5mm; color: #64748b; font-size: 7pt; font-weight: 700; letter-spacing: 1.1px; }
          .admission-receipt-header strong { display: inline-block; border: 1px solid #243b63; border-radius: 12px; padding: 1mm 4mm; color: #243b63; font-size: 8pt; }
          .admission-receipt-details { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 5mm; padding-top: 4mm; }
          .admission-receipt-details span { display: block; color: #64748b; font-size: 6.5pt; font-weight: 700; letter-spacing: .35px; text-transform: uppercase; }
          .admission-receipt-details strong { display: block; margin-top: .8mm; overflow-wrap: anywhere; color: #172033; font-size: 8.5pt; }
          .admission-receipt-teacher { grid-column: 1 / -1; }
          .admission-receipt-cutline { position: relative; height: 6mm; margin-top: 2mm; border-top: 1px dashed #64748b; text-align: center; }
          .admission-receipt-cutline span { position: relative; top: -2.6mm; padding: 0 3mm; background: #fff; color: #64748b; font-size: 6pt; font-weight: 700; letter-spacing: 1px; }
        }
      `}</style>
    </Layout>
  );
}
