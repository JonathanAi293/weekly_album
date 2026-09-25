export type ExportListeningStatus = "listened" | "not_interested" | "want_to_listen" | string | null;
export type ExportFeedbackCandidate = { listening_status:ExportListeningStatus; updated_at:string; last_exported_at:string | null };

/** In change mode, narrow by the export cursor first, then apply status eligibility. */
export function selectExportableFeedback<T extends ExportFeedbackCandidate>(rows:T[], mode:"issue" | "changes"):T[] {
  const updatedRows = mode === "changes"
    ? rows.filter(row => !row.last_exported_at || new Date(row.updated_at).getTime() > new Date(row.last_exported_at).getTime())
    : rows;
  return updatedRows.filter(row => row.listening_status === "listened" || row.listening_status === "not_interested");
}
