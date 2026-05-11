import * as XLSX from 'xlsx';

export type XlsxCellValue = string | number | boolean | Date | null | undefined;

function sanitizeSheetName(name: string): string {
  const base = (name || 'Hoja1').trim() || 'Hoja1';
  return base.replace(/[\\/*?:[\]]/g, '_').slice(0, 31);
}

function ensureXlsxName(fileName: string): string {
  const base = (fileName || 'reporte').trim() || 'reporte';
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`;
}

function computeColumnWidths(headers: string[], rows: XlsxCellValue[][]): Array<{ wch: number }> {
  return headers.map((header, colIdx) => {
    const maxRowLen = rows.reduce((acc, row) => {
      const value = row[colIdx];
      const len = value == null ? 0 : String(value).length;
      return Math.max(acc, len);
    }, 0);
    const width = Math.min(60, Math.max(header.length + 2, maxRowLen + 2, 12));
    return { wch: width };
  });
}

export function exportRowsAsXlsx(
  headers: string[],
  rows: XlsxCellValue[][],
  fileName: string,
  sheetName = 'Datos'
): void {
  const aoa: XlsxCellValue[][] = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = computeColumnWidths(headers, rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
  XLSX.writeFile(wb, ensureXlsxName(fileName), { bookType: 'xlsx' });
}

export function readFirstSheetAsRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result;
        if (!(data instanceof ArrayBuffer)) {
          reject(new Error('Formato de archivo inválido'));
          return;
        }
        const wb = XLSX.read(data, { type: 'array' });
        const firstSheetName = wb.SheetNames?.[0];
        if (!firstSheetName) {
          resolve([]);
          return;
        }
        const ws = wb.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
          header: 1,
          raw: false,
          defval: ''
        });
        const normalized = (rows || []).map((row) => (row || []).map((cell) => String(cell ?? '').trim()));
        resolve(normalized);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('No se pudo leer el archivo XLSX'));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado'));
    reader.readAsArrayBuffer(file);
  });
}
