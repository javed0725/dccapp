export async function downloadStudentMarksheetPdf(studentId: number, examKey: string): Promise<void> {
  const params = new URLSearchParams({ examKey });
  const response = await fetch(
    `/api/students/${encodeURIComponent(studentId)}/profile/marksheet.pdf?${params}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Could not generate the student marksheet PDF");
  }
  if (!response.headers.get("content-type")?.includes("application/pdf")) {
    throw new Error("The server did not return a PDF file");
  }

  const blob = await response.blob();
  const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]
    || "Student_Marksheet.pdf";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
