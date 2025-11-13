import * as XLSX from 'xlsx'
import { ParsedCSVData } from './csv-parser'

export interface ParsedXLSXData {
  sheets: string[]
  data: Record<string, any[][]>
}

export async function parseXLSX(file: File): Promise<ParsedXLSXData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const result: ParsedXLSXData = {
          sheets: workbook.SheetNames,
          data: {}
        }

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: ''
          })
          result.data[sheetName] = jsonData as any[][]
        })

        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

export function convertXLSXToCSVFormat(
  xlsxData: any[][],
  sheetName: string
): ParsedCSVData {
  if (xlsxData.length === 0) {
    return { headers: [], rows: [], errors: [] }
  }

  // First row is headers
  const headers = xlsxData[0].map((h: any) =>
    String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
  )

  // Remaining rows are data
  const rows = xlsxData.slice(1).map(row => {
    const obj: Record<string, any> = {}
    row.forEach((cell: any, index: number) => {
      const header = headers[index]
      if (header) {
        obj[header] = cell
      }
    })
    return obj
  })

  return { headers, rows, errors: [] }
}
