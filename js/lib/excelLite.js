// Bộ chọn đúng bộ đọc Excel theo định dạng file thật (nhận diện qua magic
// byte, không dựa vào đuôi file) — hỗ trợ cả .xlsx (OOXML/zip) lẫn .xls cũ
// (Excel 97-2003, OLE2 Compound File).
import { readXlsxFirstSheet, rowsToTsv } from './xlsxLite.js';
import { readXlsFirstSheet } from './xlsLite.js';

export async function readExcelFirstSheet(file) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // "PK"
  const isOle2 = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  if (isZip) return readXlsxFirstSheet(file);
  if (isOle2) return readXlsFirstSheet(file);
  throw new Error('Không nhận diện được định dạng file — chỉ hỗ trợ .xlsx hoặc .xls (Excel 97-2003).');
}

export { rowsToTsv };
