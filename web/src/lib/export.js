const COLUMN_WIDTHS = [7, 12, 24, 10, 36, 20, 10, 14, 14, 36]

// Takes the /api/register payload: paper-register headings plus rows already formatted in IST.
export async function exportRegisterToExcel({ columns, rows, from, to }) {
  // Loaded on demand so SheetJS stays out of the main bundle.
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows])
  sheet['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }))
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: columns.length - 1 } }) }

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Register')
  XLSX.writeFile(book, `Movement-Register_${from}_to_${to}.xlsx`)
}
