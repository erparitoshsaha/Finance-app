import { fetchAPI } from './api';

/**
 * Triggers a download of a Blob file in the browser
 */
export function downloadBlob(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

/**
 * Download an Excel export file from an API endpoint
 */
export async function downloadExcel(endpoint: string, defaultFilename: string = 'export.xlsx') {
  try {
    const blob = await fetchAPI(endpoint, { method: 'GET' });
    downloadBlob(blob, defaultFilename);
  } catch (error: any) {
    console.error('Failed to download Excel file:', error);
    alert(error.message || 'Failed to download Excel file.');
  }
}

/**
 * Download an error report for invalid import rows
 */
export async function downloadErrorReport(moduleKey: string, invalidRows: any[]) {
  try {
    const blob = await fetchAPI(`/excel/error-report/${moduleKey}`, {
      method: 'POST',
      bodyData: { invalidRows }
    });
    downloadBlob(blob, `${moduleKey}_import_errors.xlsx`);
  } catch (error: any) {
    console.error('Failed to download error report:', error);
    alert(error.message || 'Failed to download error report.');
  }
}
