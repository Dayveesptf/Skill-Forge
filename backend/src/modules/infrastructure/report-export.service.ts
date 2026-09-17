import zlib from "zlib";
import { buildExportRows } from "./infrastructure.service";

function escapeXml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<{ name: string; content: string }>) {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0;
  for (const entry of entries) {
    const data = zlib.deflateRawSync(Buffer.from(entry.content, "utf8"));
    const name = Buffer.from(entry.name, "utf8"); const raw = Buffer.from(entry.content, "utf8");
    const local = Buffer.alloc(30 + name.length + data.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc32(raw), 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28); name.copy(local, 30); data.copy(local, 30 + name.length); locals.push(local);
    const central = Buffer.alloc(46 + name.length); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(0, 14); central.writeUInt32LE(crc32(raw), 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42); name.copy(central, 46); centrals.push(central); offset += local.length;
  }
  const central = Buffer.concat(centrals); const local = Buffer.concat(locals); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(local.length, 16); return Buffer.concat([local, central, end]);
}

export async function buildOrganizationXlsx(organizationId: string) {
  const { analytics } = await buildExportRows(organizationId);
  const rows: Array<[string, string]> = [["Metric", "Value"], ["Generated at", String(new Date().toISOString())], ["Candidates", String(analytics.overview.candidates ?? 0)], ["Average readiness", String(analytics.overview.averageReadinessPercentage ?? 0)], ["Development areas", String(analytics.topDevelopmentAreas?.length ?? 0)]];
  const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${escapeXml(v)}</t></is></c>`).join("")}</row>`).join("");
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  return zip([{ name: "[Content_Types].xml", content: types }, { name: "_rels/.rels", content: rels }, { name: "xl/workbook.xml", content: workbook }, { name: "xl/_rels/workbook.xml.rels", content: wbRels }, { name: "xl/worksheets/sheet1.xml", content: sheet }]);
}

function pdfEscape(value: string) { return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r?\n/g, " "); }
export async function buildOrganizationPdf(organizationId: string) {
  const { analytics } = await buildExportRows(organizationId);
  const lines = ["SkillForge Organization Report", `Generated: ${new Date().toISOString()}`, `Candidates: ${analytics.overview.candidates ?? 0}`, `Average readiness: ${analytics.overview.averageReadinessPercentage ?? 0}%`, `Development areas: ${analytics.topDevelopmentAreas?.length ?? 0}`];
  let stream = "BT\n/F1 16 Tf\n50 760 Td\n";
  lines.forEach((line, index) => { if (index > 0) stream += "0 -28 Td\n/F1 11 Tf\n"; stream += `(${pdfEscape(line)}) Tj\n`; }); stream += "ET\n";
  const objects = [`<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`, `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0]; objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf, "binary")); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; }); const xref = Buffer.byteLength(pdf, "binary"); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`; pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf, "binary");
}
