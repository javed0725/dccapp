import type { ModelTestTabulation } from "@shared/model-test-results";

type DraftPdfInfo = {
  groupId: string;
  examName: string;
  className: string;
  groupName: string;
};

type PdfColumn = ModelTestTabulation["columns"][number];

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    for (let index = offset; index < end; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
  }
  return btoa(binary);
}

async function addBengaliFonts(doc: {
  addFileToVFS: (filename: string, content: string) => unknown;
  addFont: (filename: string, family: string, style: string) => unknown;
}) {
  const [regularResponse, boldResponse] = await Promise.all([
    fetch("/fonts/NotoSansBengali-Regular.ttf"),
    fetch("/fonts/NotoSansBengali-Bold.ttf"),
  ]);
  if (!regularResponse.ok || !boldResponse.ok) {
    throw new Error("Bengali font files could not be loaded for the PDF");
  }
  const [regular, bold] = await Promise.all([
    regularResponse.arrayBuffer(),
    boldResponse.arrayBuffer(),
  ]);

  doc.addFileToVFS("NotoSansBengali-Regular.ttf", toBase64(regular));
  doc.addFont("NotoSansBengali-Regular.ttf", "NotoSansBengali", "normal");
  doc.addFileToVFS("NotoSansBengali-Bold.ttf", toBase64(bold));
  doc.addFont("NotoSansBengali-Bold.ttf", "NotoSansBengali", "bold");
}

function chunkSubjectColumns(subjects: PdfColumn[], maxSubcolumns: number): PdfColumn[][] {
  const chunks: PdfColumn[][] = [];
  let currentChunk: PdfColumn[] = [];
  let currentWidth = 0;

  for (const subject of subjects) {
    const weight = Math.max(1, subject.children?.length ?? 1);
    if (currentChunk.length > 0 && currentWidth + weight > maxSubcolumns) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentWidth = 0;
    }
    currentChunk.push(subject);
    currentWidth += weight;
  }
  if (currentChunk.length > 0 || chunks.length === 0) chunks.push(currentChunk);
  return chunks;
}

function safeFilename(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9-]+/g, "_").replace(/^_+|_+$/g, "") || "class_result";
}

export async function createClassResultSheetPdf(
  draft: DraftPdfInfo,
  tabulation: ModelTestTabulation,
): Promise<import("jspdf").jsPDF> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  await addBengaliFonts(doc);

  const studentColumns = tabulation.columns.filter((column) =>
    column.key === "studentId" || column.key === "studentName"
  );
  const subjects = tabulation.columns.filter((column) => !!column.children?.length);
  const summaryColumns = tabulation.columns.filter((column) =>
    ["totalMarksObtained", "resultStatus", "meritRank"].includes(column.key)
  );
  const subjectChunks = chunkSubjectColumns(subjects, 12);
  const passed = tabulation.rows.filter((row) => row.resultStatus === "Passed").length;
  const failed = tabulation.rows.filter((row) => row.resultStatus === "Failed").length;
  const pending = tabulation.rows.filter((row) => row.resultStatus === "Pending").length;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
    const availableTableWidth = pageWidth - 20;
  const fixedWidths: Record<string, number> = {
    studentId: 20,
    studentName: 38,
    totalMarksObtained: 23,
    resultStatus: 20,
    meritRank: 17,
  };
    const fixedColumnWidth = Object.values(fixedWidths).reduce((sum, width) => sum + width, 0);

  subjectChunks.forEach((chunk, chunkIndex) => {
    if (chunkIndex > 0) doc.addPage("a4", "landscape");

    const flattenedSubjectColumns = chunk.flatMap((subject) => subject.children ?? []);
    const columnCount = studentColumns.length + flattenedSubjectColumns.length + summaryColumns.length;
    const subjectMarkWidth = Math.min(
      22,
      Math.max(8, (availableTableWidth - fixedColumnWidth) / Math.max(1, flattenedSubjectColumns.length)),
    );
    const tableWidth = fixedColumnWidth + flattenedSubjectColumns.length * subjectMarkWidth;
    const tableSideMargin = (pageWidth - tableWidth) / 2;
    const columnStyles: Record<number, { cellWidth: number; halign?: "left" | "center" }> = {};
    let columnIndex = 0;
    for (const column of studentColumns) {
      columnStyles[columnIndex++] = {
        cellWidth: fixedWidths[column.key] ?? 20,
        halign: column.key === "studentName" ? "left" : "center",
      };
    }
    columnIndex += flattenedSubjectColumns.length;
    for (const column of summaryColumns) {
      columnStyles[columnIndex++] = {
        cellWidth: fixedWidths[column.key] ?? 20,
        halign: "center",
      };
    }
    const subjectColumnStart = studentColumns.length;
    flattenedSubjectColumns.forEach((_, index) => {
      columnStyles[subjectColumnStart + index] = { cellWidth: subjectMarkWidth, halign: "center" };
    });

    const firstHeaderRow = [
      ...studentColumns.map((column) => ({
        content: column.label,
        rowSpan: 2,
        styles: { valign: "middle", halign: "center" },
      })),
      ...chunk.map((subject) => ({
        content: subject.label,
        colSpan: subject.children?.length ?? 1,
        styles: { halign: "center", valign: "middle" },
      })),
      ...summaryColumns.map((column) => ({
        content: column.label,
        rowSpan: 2,
        styles: { valign: "middle", halign: "center" },
      })),
    ];
    const secondHeaderRow = chunk.flatMap((subject) =>
      (subject.children ?? []).map((column) => ({
        content: `${column.label === "Practical" ? "Prac." : column.label} / ${column.max}`,
        styles: { halign: "center", valign: "middle" },
      }))
    );
    const head = [firstHeaderRow, secondHeaderRow];
    const body = tabulation.rows.map((row) => [
      ...studentColumns.map((column) => String(row[column.key] ?? "—")),
      ...flattenedSubjectColumns.map((column) => {
        const value = row[column.key];
        return value === null || value === undefined ? "—" : String(value);
      }),
      ...summaryColumns.map((column) => String(row[column.key] ?? "—")),
    ]);
    if (body.length === 0) {
      body.push([
        "—",
        "No student results available",
        ...flattenedSubjectColumns.map(() => "—"),
        ...summaryColumns.map(() => "—"),
      ]);
    }

    autoTable(doc, {
      head: head as any,
      body,
      startY: 37,
      margin: { top: 37, right: tableSideMargin, bottom: 17, left: tableSideMargin },
      tableWidth,
      styles: {
        font: "NotoSansBengali",
        fontSize: 7,
        cellPadding: 1.4,
        overflow: "linebreak",
        lineColor: [185, 192, 204],
        lineWidth: 0.2,
        minCellHeight: 5,
      },
      headStyles: {
        font: "NotoSansBengali",
        fontStyle: "bold",
        fillColor: [37, 54, 87],
        textColor: [255, 255, 255],
        lineColor: [120, 133, 154],
        halign: "center",
      },
      columnStyles,
      alternateRowStyles: { fillColor: [246, 248, 252] },
      showHead: "everyPage",
      didParseCell(data) {
        if (data.section !== "body") return;
        const resultStatusIndex = studentColumns.length + flattenedSubjectColumns.length
          + summaryColumns.findIndex((column) => column.key === "resultStatus");
        if (data.column.index === resultStatusIndex) {
          const status = String(data.cell.raw);
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = status === "Passed"
            ? [22, 101, 52]
            : status === "Failed"
              ? [185, 28, 28]
              : [161, 98, 7];
        }
        if (data.column.index === columnCount - 1) {
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage(data) {
        doc.setTextColor(24, 34, 55);
        doc.setFont("NotoSansBengali", "bold");
        doc.setFontSize(14);
        doc.text("Dynamic Coaching Center", pageWidth / 2, 10, { align: "center" });
        doc.setFontSize(11);
        doc.text(draft.examName, pageWidth / 2, 17, { align: "center", maxWidth: pageWidth - 24 });
        doc.setFont("NotoSansBengali", "normal");
        doc.setFontSize(8);
        doc.text(
          `Class: ${draft.className}   |   Group: ${draft.groupName}   |   Part ${chunkIndex + 1}/${subjectChunks.length}`,
          pageWidth / 2,
          24,
          { align: "center", maxWidth: pageWidth - 24 },
        );
        doc.setDrawColor(160, 170, 188);
        doc.setLineWidth(0.25);
        doc.line(10, 28, pageWidth - 10, 28);
        doc.setFontSize(7);
        doc.setTextColor(75, 85, 99);
        doc.text(
          `Passed: ${passed}   Failed: ${failed}   Pending: ${pending}`,
          10,
          pageHeight - 7,
        );
        doc.text(`Page ${data.pageNumber}`, pageWidth - 10, pageHeight - 7, { align: "right" });
      },
    });
  });

  return doc;
}

export async function downloadClassResultSheetPdf(
  draft: DraftPdfInfo,
  tabulation: ModelTestTabulation,
): Promise<void> {
  const doc = await createClassResultSheetPdf(draft, tabulation);
  doc.save(`${safeFilename(draft.examName)}_${safeFilename(draft.className)}_Result_Sheet.pdf`);
}
