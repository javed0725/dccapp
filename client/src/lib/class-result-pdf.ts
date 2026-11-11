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

function subjectValueColumns(subject: PdfColumn): NonNullable<PdfColumn["children"]> {
  const children = subject.children ?? [];
  const components = children.filter((column) =>
    column.label.trim().toLowerCase() !== "total"
    && !/(^|_)total$/i.test(column.key)
  );
  // Total-only subjects still need one score cell; component subjects rely on
  // the grand total at the end of the row instead of a per-subject total cell.
  return components.length > 0 ? components : children.slice(0, 1);
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
  // Keep the cumulative score as the final column while retaining status/rank.
  const summaryOrder = ["resultStatus", "meritRank", "totalMarksObtained"];
  const summaryColumns = summaryOrder
    .map((key) => tabulation.columns.find((column) => column.key === key))
    .filter((column): column is PdfColumn => !!column);
  const subjectCells = subjects.map(subjectValueColumns);
  const flattenedSubjectColumns = subjectCells.flat();
  const passed = tabulation.rows.filter((row) => row.resultStatus === "Passed").length;
  const failed = tabulation.rows.filter((row) => row.resultStatus === "Failed").length;
  const pending = tabulation.rows.filter((row) => row.resultStatus === "Pending").length;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableSideMargin = 6;
  const availableTableWidth = pageWidth - tableSideMargin * 2;
  const fixedWidths: Record<string, number> = {
    studentId: 16,
    studentName: 31,
    totalMarksObtained: 20,
    resultStatus: 16,
    meritRank: 13,
  };
  const fixedColumnWidth = [...studentColumns, ...summaryColumns]
    .reduce((sum, column) => sum + (fixedWidths[column.key] ?? 16), 0);
  const subjectMarkWidth = flattenedSubjectColumns.length > 0
    ? (availableTableWidth - fixedColumnWidth) / flattenedSubjectColumns.length
    : 0;
  const tableWidth = fixedColumnWidth + flattenedSubjectColumns.length * subjectMarkWidth;
  const tableLeftMargin = (pageWidth - tableWidth) / 2;
  const subjectFontSize = subjectMarkWidth > 15 ? 6.4 : Math.max(2.6, subjectMarkWidth * 0.43);
  const rowCount = Math.max(1, tabulation.rows.length);
  const tableStartY = 32;
  const bottomMargin = 13;
  const headerHeightEstimate = 9;
  const rowHeightBudget = (pageHeight - tableStartY - bottomMargin - headerHeightEstimate) / rowCount;
  const rowFontSize = Math.max(2.6, Math.min(6.2, (rowHeightBudget - 0.25) / 0.406));
  const fontSize = Math.min(subjectFontSize, rowFontSize);
  const cellPadding = Math.max(0.08, Math.min(0.6, (rowHeightBudget - fontSize * 0.406) / 2));
  const columnStyles: Record<number, { cellWidth: number; halign?: "left" | "center" }> = {};

  let columnIndex = 0;
  for (const column of studentColumns) {
    columnStyles[columnIndex++] = {
      cellWidth: fixedWidths[column.key] ?? 16,
      halign: column.key === "studentName" ? "left" : "center",
    };
  }
  flattenedSubjectColumns.forEach((_, index) => {
    columnStyles[columnIndex + index] = { cellWidth: subjectMarkWidth, halign: "center" };
  });
  columnIndex += flattenedSubjectColumns.length;
  for (const column of summaryColumns) {
    columnStyles[columnIndex++] = { cellWidth: fixedWidths[column.key] ?? 16, halign: "center" };
  }

  const firstHeaderRow = [
    ...studentColumns.map((column) => ({
      content: column.label,
      rowSpan: 2,
      styles: { valign: "middle", halign: "center" },
    })),
    ...subjects.map((subject, index) => ({
      content: subject.label,
      colSpan: subjectCells[index].length,
      styles: { halign: "center", valign: "middle" },
    })),
    ...summaryColumns.map((column) => ({
      content: column.label,
      rowSpan: 2,
      styles: { valign: "middle", halign: "center" },
    })),
  ];
  const secondHeaderRow = subjectCells.flatMap((columns) =>
    columns.map((column) => ({
      content: column.label.trim().toLowerCase() === "total" ? "Marks" : column.label,
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

  const columnCount = studentColumns.length + flattenedSubjectColumns.length + summaryColumns.length;
  autoTable(doc, {
    head: head as any,
    body,
    startY: tableStartY,
    margin: { top: tableStartY, right: tableLeftMargin, bottom: bottomMargin, left: tableLeftMargin },
    tableWidth,
    styles: {
      font: "NotoSansBengali",
      fontSize,
      cellPadding: { top: cellPadding, right: 0.4, bottom: cellPadding, left: 0.4 },
      overflow: "linebreak",
      lineColor: [185, 192, 204],
      lineWidth: 0.15,
      minCellHeight: 0,
    },
    headStyles: {
      font: "NotoSansBengali",
      fontStyle: "bold",
      fontSize: Math.max(3, fontSize),
      cellPadding: { top: 0.4, right: 0.25, bottom: 0.4, left: 0.25 },
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
      doc.text("Dynamic Coaching Center", pageWidth / 2, 9, { align: "center" });
      doc.setFontSize(10);
      doc.text(draft.examName, pageWidth / 2, 16, { align: "center", maxWidth: pageWidth - 24 });
      doc.setFont("NotoSansBengali", "normal");
      doc.setFontSize(7);
      doc.text(
        `Class: ${draft.className}   |   Group: ${draft.groupName}`,
        pageWidth / 2,
        23,
        { align: "center", maxWidth: pageWidth - 24 },
      );
      doc.setDrawColor(160, 170, 188);
      doc.setLineWidth(0.25);
      doc.line(6, 27, pageWidth - 6, 27);
      doc.setFontSize(6.5);
      doc.setTextColor(75, 85, 99);
      doc.text(`Passed: ${passed}   Failed: ${failed}   Pending: ${pending}`, 6, pageHeight - 5);
      if (doc.getNumberOfPages() > 1) {
        doc.text(`Page ${data.pageNumber}`, pageWidth - 6, pageHeight - 5, { align: "right" });
      }
    },
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
