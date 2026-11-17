async function downloadPdf(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(path, {
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
    || fallbackName;
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

export function downloadClassResultSheetPdf(groupId: string): Promise<void> {
  return downloadPdf(
    `/api/model-test-drafts/${encodeURIComponent(groupId)}/pdf`,
    "Class_Result_Sheet.pdf",
  );
}

export function downloadAllIndividualMarksheetsPdf(groupId: string): Promise<void> {
  return downloadPdf(
    `/api/model-test-drafts/${encodeURIComponent(groupId)}/individual-marksheets.pdf`,
    "Individual_Marksheets.pdf",
  );
}
