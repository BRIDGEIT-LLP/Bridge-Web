/**
 * Client-side CSV export for the admin tables ("Export" buttons).
 *
 * Deliberately dependency-free: the file is built as a CSV and opens straight into
 * Excel / Sheets. If a native `.xlsx` workbook is ever required (styling, multiple
 * sheets, typed cells), swap the body of `downloadCsv` for a writer library — the
 * call sites below only pass columns + rows and don't care how the bytes are made.
 */

/** One exported column: its header text and how to read it off a row. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Quote a single field. Everything is quoted rather than only the risky values —
 * it's valid CSV either way and keeps the output stable when data changes.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with a tab so Excel treats it as text
 * instead of a formula (CSV injection — the values come from user-entered names).
 */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `\t${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Append the date so repeated exports don't overwrite each other in Downloads. */
function stampedName(baseName: string): string {
  const [date] = new Date().toISOString().split("T");
  return `${baseName}-${date}.csv`;
}

/**
 * Build a CSV from `rows` and hand it to the browser as a download.
 * `baseName` is the file name without extension or date (e.g. "admins").
 */
export function downloadCsv<T>(baseName: string, columns: CsvColumn<T>[], rows: T[]): void {
  const lines = [
    columns.map((c) => cell(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(",")),
  ];

  // The BOM is what makes Excel read the file as UTF-8 — without it, non-ASCII
  // names (and the ₹ sign) come through mangled.
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = stampedName(baseName);
  a.click();
  URL.revokeObjectURL(url);
}
