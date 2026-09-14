/**
 * Reading the workbook.
 *
 * The parser is loaded on demand: it is only needed on the import screen, so
 * keeping it out of the initial bundle means the rest of the product stays as
 * quick to open as it was before Excel support existed.
 */

import type { RawSheet } from './plan'

export class WorkbookError extends Error {}

export async function readWorkbook(file: File): Promise<RawSheet[]> {
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    if (/\.xls$/i.test(file.name)) {
      throw new WorkbookError(
        'This is the older .xls format. Open it in Excel or Google Sheets and save it as .xlsx, then upload again.',
      )
    }
    throw new WorkbookError('That is not a spreadsheet. Upload an .xlsx file.')
  }

  const { default: readXlsxFile } = await import('read-excel-file/browser')
  let sheets
  try {
    sheets = await readXlsxFile(file)
  } catch (err) {
    throw new WorkbookError(
      err instanceof Error && /password|encrypt/i.test(err.message)
        ? 'That workbook is password protected. Remove the password and upload it again.'
        : 'That file could not be opened as a spreadsheet. It may be damaged.',
    )
  }

  const raw: RawSheet[] = sheets.map((s) => ({ name: s.sheet, rows: s.data as RawSheet['rows'] }))
  if (raw.every((s) => s.rows.length === 0)) throw new WorkbookError('The workbook has no rows in it.')
  return raw
}

/**
 * A stable fingerprint of the workbook's shape.
 *
 * Two exports of the same report have the same sheet names and headers even
 * though their rows differ, so this is what lets a corrected mapping be
 * remembered and reapplied next month.
 */
export function workbookSignature(sheets: RawSheet[], headerRows: number[]): string {
  return sheets
    .map((s, i) => {
      const header = (s.rows[headerRows[i] ?? 0] ?? [])
        .map((c) => String(c ?? '').trim().toLowerCase())
        .filter(Boolean)
        .join(',')
      return `${s.name.toLowerCase()}::${header}`
    })
    .sort()
    .join('||')
}
