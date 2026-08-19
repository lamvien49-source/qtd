// Bộ đọc file .xls CŨ (Excel 97-2003: OLE2 Compound File Binary + BIFF8),
// thuần trình duyệt, không dùng thư viện ngoài (không phải SheetJS/xlrd...).
// Chỉ hỗ trợ cấu trúc CFB "chuẩn" (cỡ sector 512 byte) — đúng với hầu hết
// file .xls xuất ra từ Excel / phần mềm kế toán.

const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;
const DIFSECT = 0xfffffffc;
const HEADER_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function readOle2(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== HEADER_SIG[i]) throw new Error('Không đúng định dạng .xls (không phải OLE2 Compound File).');
  }
  const sectorShift = view.getUint16(30, true);
  const SECT_SIZE = 1 << sectorShift;
  const miniSectorShift = view.getUint16(32, true);
  const MINI_SECT_SIZE = 1 << miniSectorShift;
  const dirStart = view.getUint32(48, true);
  const miniCutoff = view.getUint32(56, true);
  const minifatStart = view.getUint32(60, true);
  const numMinifatSectors = view.getUint32(64, true);
  const difatStart = view.getUint32(68, true);
  const numDifatSectors = view.getUint32(72, true);

  const sectorOffset = (sect) => 512 + sect * SECT_SIZE;

  const difat = [];
  for (let i = 0; i < 109; i++) difat.push(view.getUint32(76 + i * 4, true));
  let s = difatStart;
  for (let i = 0; i < numDifatSectors && s !== ENDOFCHAIN; i++) {
    const off = sectorOffset(s);
    for (let j = 0; j < 127; j++) difat.push(view.getUint32(off + j * 4, true));
    s = view.getUint32(off + 127 * 4, true);
  }

  const fat = [];
  for (const fatSect of difat) {
    if (fatSect === FREESECT || fatSect === FATSECT || fatSect === DIFSECT || fatSect === ENDOFCHAIN) continue;
    const off = sectorOffset(fatSect);
    for (let j = 0; j < SECT_SIZE / 4; j++) fat.push(view.getUint32(off + j * 4, true));
  }

  function readChain(startSect, sizeHint) {
    const chunks = [];
    let sect = startSect;
    const seen = new Set();
    let total = 0;
    while (sect !== ENDOFCHAIN && sect !== undefined && !seen.has(sect)) {
      seen.add(sect);
      const off = sectorOffset(sect);
      const chunk = bytes.subarray(off, off + SECT_SIZE);
      chunks.push(chunk);
      total += chunk.length;
      sect = fat[sect];
    }
    const outLen = sizeHint != null ? Math.min(sizeHint, total) : total;
    const out = new Uint8Array(outLen);
    let p = 0;
    for (const c of chunks) {
      const take = Math.min(c.length, out.length - p);
      if (take <= 0) break;
      out.set(c.subarray(0, take), p);
      p += take;
    }
    return out;
  }

  const dirData = readChain(dirStart);
  const dirView = new DataView(dirData.buffer, dirData.byteOffset, dirData.byteLength);
  const numDirEntries = Math.floor(dirData.length / 128);
  const entries = [];
  for (let i = 0; i < numDirEntries; i++) {
    const base = i * 128;
    const nameLen = dirView.getUint16(base + 64, true);
    const name = nameLen > 1 ? new TextDecoder('utf-16le').decode(dirData.subarray(base, base + nameLen - 2)) : '';
    const objType = dirData[base + 66];
    const startSect = dirView.getUint32(base + 116, true);
    const size = dirView.getUint32(base + 120, true); // đủ dùng cho file .xls (< 4GB)
    entries.push({ name, type: objType, start: startSect, size });
  }

  const root = entries.find((e) => e.type === 5);
  let ministream = new Uint8Array(0);
  const minifat = [];
  if (root) {
    ministream = readChain(root.start, root.size);
    if (numMinifatSectors) {
      const mfData = readChain(minifatStart);
      const mfView = new DataView(mfData.buffer, mfData.byteOffset, mfData.byteLength);
      for (let i = 0; i < Math.floor(mfData.length / 4); i++) minifat.push(mfView.getUint32(i * 4, true));
    }
  }

  function readMiniChain(startSect, sizeHint) {
    const chunks = [];
    let sect = startSect;
    const seen = new Set();
    let total = 0;
    while (sect !== ENDOFCHAIN && sect !== undefined && !seen.has(sect)) {
      seen.add(sect);
      const off = sect * MINI_SECT_SIZE;
      const chunk = ministream.subarray(off, off + MINI_SECT_SIZE);
      chunks.push(chunk);
      total += chunk.length;
      sect = minifat[sect];
    }
    const out = new Uint8Array(Math.min(sizeHint, total));
    let p = 0;
    for (const c of chunks) {
      const take = Math.min(c.length, out.length - p);
      if (take <= 0) break;
      out.set(c.subarray(0, take), p);
      p += take;
    }
    return out;
  }

  function readStream(entry) {
    return entry.size < miniCutoff ? readMiniChain(entry.start, entry.size) : readChain(entry.start, entry.size);
  }

  return { entries, readStream };
}

// ------------------------------------------------------------
// BIFF8: đọc các "bản ghi" (record) dạng [type(2) len(2) data(len)]
// ------------------------------------------------------------
function walkRecords(buf, startOffset = 0) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const records = [];
  let pos = startOffset;
  while (pos + 4 <= buf.length) {
    const type = view.getUint16(pos, true);
    const len = view.getUint16(pos + 2, true);
    const offset = pos + 4;
    const end = Math.min(buf.length, offset + len);
    records.push({ type, offset, len: end - offset, pos });
    pos = offset + len;
    if (type === 0x000a) break; // dừng ở EOF — hết 1 substream (globals hoặc 1 sheet)
  }
  return records;
}

/** Bảng chuỗi dùng chung (Shared String Table) — record SST (0xFC) + các CONTINUE (0x3C) nối theo sau. */
function parseSST(buf, records) {
  const sstIdx = records.findIndex((r) => r.type === 0x00fc);
  if (sstIdx < 0) return [];
  const segments = [{ start: records[sstIdx].offset, end: records[sstIdx].offset + records[sstIdx].len }];
  let j = sstIdx + 1;
  while (j < records.length && records[j].type === 0x003c) {
    segments.push({ start: records[j].offset, end: records[j].offset + records[j].len });
    j++;
  }
  let segI = 0;
  let segOff = segments[0].start;
  const atBoundary = () => segOff >= segments[segI].end;
  const getByte = () => {
    while (segOff >= segments[segI].end) { segI++; segOff = segments[segI].start; }
    return buf[segOff++];
  };
  const getU16 = () => getByte() | (getByte() << 8);
  const getU32 = () => (getByte() | (getByte() << 8) | (getByte() << 16) | (getByte() << 24)) >>> 0;
  const skip = (n) => { for (let i = 0; i < n; i++) getByte(); };

  getU32(); // cstTotal — không dùng
  const cstUnique = getU32();
  const strings = [];
  for (let idx = 0; idx < cstUnique; idx++) {
    const cch = getU16();
    let grbit = getByte();
    let fHighByte = grbit & 0x1;
    const fExtSt = (grbit >> 2) & 0x1;
    const fRichSt = (grbit >> 3) & 0x1;
    const cRun = fRichSt ? getU16() : 0;
    const cbExtRst = fExtSt ? getU32() : 0;
    const chars = [];
    let remaining = cch;
    while (remaining > 0) {
      if (atBoundary()) { const newGrbit = getByte(); fHighByte = newGrbit & 0x1; }
      chars.push(fHighByte ? getU16() : getByte());
      remaining--;
    }
    skip(cRun * 4);
    if (fExtSt) skip(cbExtRst);
    strings.push(String.fromCharCode(...chars));
  }
  return strings;
}

/** Vị trí (offset) bắt đầu substream của sheet đầu tiên, lấy từ record BOUNDSHEET (0x85) đầu tiên. */
function firstSheetOffset(buf, records) {
  const rec = records.find((r) => r.type === 0x0085);
  if (!rec) return null;
  return new DataView(buf.buffer, buf.byteOffset + rec.offset, rec.len).getUint32(0, true);
}

/** Giải mã số kiểu RK (BIFF nén số thực/nguyên vào 4 byte để tiết kiệm chỗ). */
function decodeRk(rk) {
  const fX100 = rk & 0x1;
  const fInt = rk & 0x2;
  let value;
  if (fInt) {
    value = rk >> 2;
  } else {
    const b = new ArrayBuffer(8);
    const dv = new DataView(b);
    dv.setInt32(0, 0, true);
    dv.setInt32(4, rk & 0xfffffffc, true);
    value = dv.getFloat64(0, true);
  }
  return fX100 ? value / 100 : value;
}

function parseBiffFirstSheet(wbBuf) {
  const globalRecords = walkRecords(wbBuf, 0);
  const sst = parseSST(wbBuf, globalRecords);
  const sheetOffset = firstSheetOffset(wbBuf, globalRecords);
  if (sheetOffset == null) throw new Error('Không tìm thấy sheet nào trong file .xls.');

  const rows = [];
  const setCell = (r, c, v) => { if (!rows[r]) rows[r] = []; rows[r][c] = v; };

  const sheetRecords = walkRecords(wbBuf, sheetOffset);
  for (const rec of sheetRecords) {
    if (rec.len < 4) continue;
    const dv = new DataView(wbBuf.buffer, wbBuf.byteOffset + rec.offset, rec.len);
    switch (rec.type) {
      case 0x00fd: { // LABELSST — chuỗi tham chiếu vào SST
        const rw = dv.getUint16(0, true), col = dv.getUint16(2, true), isst = dv.getUint32(6, true);
        setCell(rw, col, sst[isst] ?? '');
        break;
      }
      case 0x0203: { // NUMBER — số thực đầy đủ (8 byte)
        const rw = dv.getUint16(0, true), col = dv.getUint16(2, true);
        setCell(rw, col, dv.getFloat64(6, true));
        break;
      }
      case 0x027e: { // RK — số nén 4 byte
        const rw = dv.getUint16(0, true), col = dv.getUint16(2, true);
        setCell(rw, col, decodeRk(dv.getInt32(6, true)));
        break;
      }
      case 0x00bd: { // MULRK — nhiều ô RK liên tiếp trong 1 record
        const rw = dv.getUint16(0, true), colFirst = dv.getUint16(2, true);
        const n = Math.floor((rec.len - 6) / 6);
        for (let i = 0; i < n; i++) setCell(rw, colFirst + i, decodeRk(dv.getInt32(4 + i * 6 + 2, true)));
        break;
      }
      case 0x0204: { // LABEL — chuỗi kiểu cũ (không qua SST), hiếm gặp trong BIFF8
        const rw = dv.getUint16(0, true), col = dv.getUint16(2, true);
        const cch = dv.getUint16(6, true);
        const grbit = dv.getUint8(8);
        const chars = [];
        for (let i = 0; i < cch; i++) chars.push(grbit & 0x1 ? dv.getUint16(9 + i * 2, true) : dv.getUint8(9 + i));
        setCell(rw, col, String.fromCharCode(...chars));
        break;
      }
      default:
        break; // BLANK, ROW, FORMULA, định dạng... không cần cho việc đọc dữ liệu bảng
    }
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/**
 * Đọc file .xls (Excel 97-2003, đối tượng File từ input) -> trả về mảng 2
 * chiều (rows x cols) của sheet đầu tiên trong workbook — cùng định dạng
 * kết quả với readXlsxFirstSheet() ở xlsxLite.js.
 */
export async function readXlsFirstSheet(file) {
  const buf = await file.arrayBuffer();
  const ole = readOle2(buf);
  const wbEntry = ole.entries.find((e) => e.name === 'Workbook' || e.name === 'Book');
  if (!wbEntry) throw new Error('Không tìm thấy dữ liệu bảng tính trong file .xls (thiếu luồng Workbook/Book).');
  return parseBiffFirstSheet(ole.readStream(wbEntry));
}
