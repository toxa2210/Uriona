import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const workbookPath = process.argv[2];
const outputPath = process.argv[3] ?? "prisma/migrations/20261028130000_import_emu_branches/migration.sql";
if (!workbookPath) throw new Error("Usage: node scripts/generate-emu-branch-migration.mjs <workbook.xlsx> [output.sql]");

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);
const worksheet = workbook.getWorksheet("Филиалы");
if (!worksheet) throw new Error('Workbook must contain the "Филиалы" sheet');

const text = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && "text" in value) return String(value.text).trim();
  return "";
};
const sql = (value) => value === null || value === undefined || value === ""
  ? "NULL"
  : `'${String(value).replaceAll("'", "''")}'`;
const numeric = (value) => typeof value === "number" && Number.isFinite(value) ? String(value) : "NULL";
const rows = [];
const ids = new Set();

for (let rowNumber = 6; rowNumber <= worksheet.rowCount; rowNumber += 1) {
  const row = worksheet.getRow(rowNumber);
  const number = text(row.getCell(1).value);
  const name = text(row.getCell(2).value);
  if (!number || !name) continue;
  if (ids.has(number)) throw new Error(`Duplicate branch number: ${number}`);
  ids.add(number);

  const region = text(row.getCell(3).value);
  const locality = text(row.getCell(4).value);
  const address = text(row.getCell(5).value);
  if (!region || !locality || !address) throw new Error(`Missing branch address fields on row ${rowNumber}`);
  const mapValue = row.getCell(13).value;
  const mapUrl = mapValue && typeof mapValue === "object" && "hyperlink" in mapValue ? String(mapValue.hyperlink) : null;
  const branchId = `emu-${number}`;
  rows.push(`(${sql(branchId)}, ${sql(branchId)}, 'EMU_EXPRESS', ${sql(name)}, ${sql(region)}, ${sql(locality)}, ${sql(address)}, ${sql(text(row.getCell(6).value) || null)}, ${sql(text(row.getCell(7).value) || null)}, ${text(row.getCell(8).value).toLowerCase() === "есть"}, ${text(row.getCell(9).value).toLowerCase() === "есть"}, ${numeric(row.getCell(11).value)}, ${numeric(row.getCell(12).value)}, ${sql(mapUrl)}, TRUE)`);
}

const migration = `INSERT INTO "ShippingBranch" ("id", "externalId", "carrier", "name", "region", "locality", "address", "phone", "workingHours", "acceptsCash", "acceptsCard", "latitude", "longitude", "mapUrl", "isActive") VALUES\n${rows.join(",\n")}\nON CONFLICT ("externalId") DO UPDATE SET "name"=EXCLUDED."name", "region"=EXCLUDED."region", "locality"=EXCLUDED."locality", "address"=EXCLUDED."address", "phone"=EXCLUDED."phone", "workingHours"=EXCLUDED."workingHours", "acceptsCash"=EXCLUDED."acceptsCash", "acceptsCard"=EXCLUDED."acceptsCard", "latitude"=EXCLUDED."latitude", "longitude"=EXCLUDED."longitude", "mapUrl"=EXCLUDED."mapUrl", "isActive"=TRUE;\n`;
const absoluteOutput = resolve(outputPath);
await mkdir(dirname(absoluteOutput), { recursive: true });
await writeFile(absoluteOutput, migration, "utf8");
console.log(`Generated migration with ${rows.length} EMU branches at ${absoluteOutput}`);
