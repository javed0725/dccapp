export async function downloadClassResultSheetPdf(groupId: string): Promise<void> {
  const response = await fetch(`/api/model-test-drafts/${encodeURIComponent(groupId)}/pdf`, {
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Could not generate the class result PDF");
  }
  if (!response.headers.get("content-type")?.includes("application/pdf")) {
    throw new Error("The server did not return a PDF file");
  }
  const blob = await response.blob();
  const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]
    || "Class_Result_Sheet.pdf";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Mobile browsers may start reading the blob only after the click completes.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
