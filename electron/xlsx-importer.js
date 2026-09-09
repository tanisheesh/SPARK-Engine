const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const unzipper = require('unzipper');
const { sanitizeIdentifier } = require('./source-registry');

// Excel workbooks are converted to one staged CSV per sheet, then handed to the
// existing duckdbClient.importCSV path. DuckDB can only read .xlsx through its
// `excel` extension, which has to be downloaded at runtime and exposes no way to
// enumerate sheet names - so a workbook would collapse to its first sheet. Going
// through CSV keeps every sheet as its own table, which is what makes cross-sheet
// relationships show up in the ER diagram.
//
// Rows are streamed rather than loaded whole, so a wide 500k-row sheet costs a
// roughly constant amount of memory.

// ---------------------------------------------------------------------------
// Sheet names
//
// exceljs's streaming reader resolves sheet names from xl/workbook.xml, but it
// only parses that entry if the zip happens to store it before the worksheets.
// Files written by exceljs itself store it after, so the lookup dereferences an
// undefined model and throws (`Cannot read properties of undefined (reading
// 'sheets')`). Rather than depend on zip ordering, read the names out of the
// archive ourselves and pin exceljs's model to an empty stub so its own lookup
// always misses - which keeps `worksheet.id` equal to the sheet number from
// `worksheets/sheetN.xml`, giving us a stable key to join on.
// ---------------------------------------------------------------------------

async function readZipText(xlsxPath, entryPath) {
  const directory = await unzipper.Open.file(xlsxPath);
  const entry = directory.files.find(f => f.path === entryPath);
  if (!entry) return null;
  const buffer = await entry.buffer();
  return buffer.toString('utf8');
}

// Reads what we need out of xl/workbook.xml ourselves: the sheet number N (from
// worksheets/sheetN.xml) mapped to its display name, plus the date1904 epoch flag
// that exceljs needs to convert date cells (see the properties stub below).
async function readWorkbookMeta(xlsxPath) {
  const [workbookXml, relsXml] = await Promise.all([
    readZipText(xlsxPath, 'xl/workbook.xml'),
    readZipText(xlsxPath, 'xl/_rels/workbook.xml.rels')
  ]);
  const names = new Map();
  // Legacy Mac workbooks count days from 1904 instead of 1900.
  const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/i.test(workbookXml || '');
  if (!workbookXml || !relsXml) return { names, date1904 };

  // rId -> worksheets/sheetN.xml
  const relTargets = new Map();
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = match[0];
    const id = /\bId="([^"]+)"/.exec(tag);
    const target = /\bTarget="([^"]+)"/.exec(tag);
    if (id && target) relTargets.set(id[1], target[1]);
  }

  for (const match of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const tag = match[0];
    const name = /\bname="([^"]*)"/.exec(tag);
    const rid = /\br:id="([^"]+)"/.exec(tag);
    if (!name || !rid) continue;
    const target = relTargets.get(rid[1]);
    if (!target) continue;
    const sheetNo = /sheet(\d+)\.xml$/i.exec(target);
    if (!sheetNo) continue;
    names.set(sheetNo[1], decodeXmlEntities(name[1]));
  }
  return { names, date1904 };
}

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// Cell / row formatting
// ---------------------------------------------------------------------------

// Excel cell values arrive as several shapes depending on the cell type.
// Flatten each to the text that belongs in a CSV field.
function cellToString(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // Formula cells carry both the formula and its cached result; we want the result.
    if ('result' in value) return cellToString(value.result);
    if ('richText' in value) return value.richText.map(part => part.text).join('');
    if ('text' in value) return cellToString(value.text);
    if ('hyperlink' in value) return String(value.hyperlink);
    if ('error' in value) return '';
    return '';
  }
  return String(value);
}

// Minimal RFC 4180 quoting - quote only when the field would otherwise break
// the row, and double any embedded quotes.
function toCsvField(value) {
  const text = cellToString(value);
  if (text === '') return '';
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsvRow(values, width) {
  const fields = [];
  for (let i = 0; i < width; i++) fields.push(toCsvField(values[i]));
  return `${fields.join(',')}\n`;
}

// exceljs rows are 1-indexed and sparse: row.values[0] is always empty and gaps
// between populated cells are holes. Normalise to a dense 0-indexed array.
function denseValues(row) {
  const raw = Array.isArray(row.values) ? row.values : [];
  const out = [];
  for (let i = 1; i < raw.length; i++) out.push(raw[i] === undefined ? '' : raw[i]);
  return out;
}

// Build unique, non-empty column names from the header row. Excel sheets very
// often have a blank or duplicated header, and DuckDB needs distinct names.
function buildHeaders(values) {
  const seen = new Map();
  return values.map((value, index) => {
    let name = cellToString(value).trim();
    if (!name) name = `column_${index + 1}`;
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });
}

async function writeLine(stream, line) {
  if (!stream.write(line)) {
    await new Promise(resolve => stream.once('drain', resolve));
  }
}

/**
 * Convert every non-empty sheet of a workbook into a staged CSV file.
 *
 * @param {string} xlsxPath  Absolute path to the .xlsx/.xls file
 * @param {string} outDir    Directory the staged CSVs are written into
 * @returns {Promise<Array<{sheetName: string, csvPath: string, tableName: string, rows: number}>>}
 */
async function convertWorkbookToCSVs(xlsxPath, outDir) {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error('Excel file not found');
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const baseName = sanitizeIdentifier(path.basename(xlsxPath).replace(/\.(xlsx|xls)$/i, ''));

  let sheetNames = new Map();
  let date1904 = false;
  try {
    const meta = await readWorkbookMeta(xlsxPath);
    sheetNames = meta.names;
    date1904 = meta.date1904;
  } catch (error) {
    console.warn('⚠️ Could not read workbook metadata:', error.message);
  }

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(xlsxPath, {
    entries: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    // Styles must be cached, not ignored: Excel stores dates as serial numbers
    // and only the cell's number format marks them as dates. Without this a
    // date column imports as BIGINT (46037) instead of a real timestamp.
    // Styles are per-workbook, not per-row, so this costs little memory.
    styles: 'cache',
    worksheets: 'emit'
  });

  // See the note above: a permanently empty model makes exceljs's own name
  // lookup miss instead of throwing, and keeps worksheet.id as the sheet number.
  // The setter swallows exceljs's later assignment without throwing under strict mode.
  const stubModel = { sheets: [] };
  Object.defineProperty(reader, 'model', {
    configurable: true,
    get: () => stubModel,
    set: () => {}
  });

  // Same root cause: exceljs reads the date epoch from workbook.xml too, and the
  // date-cell branch dereferences it unguarded. Seed it from our own read so date
  // columns convert instead of crashing. A plain assignment, so if exceljs does
  // parse workbook.xml it can still replace this with the authoritative value.
  reader.properties = { model: { date1904 } };

  const sheets = [];

  for await (const worksheet of reader) {
    const sheetNo = String(worksheet.id);
    const sheetName = sheetNames.get(sheetNo) || `Sheet${sheetNo}`;
    const csvPath = path.join(outDir, `${baseName}__sheet${sheetNo}.csv`);

    let stream = null;
    let headerWidth = 0;
    let rows = 0;

    for await (const row of worksheet) {
      const values = denseValues(row);

      if (stream === null) {
        // First row of the sheet is the header. A sheet whose first row is
        // entirely blank has nothing usable, so skip the sheet entirely.
        const headers = buildHeaders(values);
        if (headers.length === 0) break;
        headerWidth = headers.length;
        stream = fs.createWriteStream(csvPath, { encoding: 'utf8' });
        await writeLine(stream, toCsvRow(headers, headerWidth));
        continue;
      }

      // Skip fully blank rows - Excel commonly reports trailing empties.
      if (values.every(v => cellToString(v) === '')) continue;

      await writeLine(stream, toCsvRow(values, headerWidth));
      rows++;
    }

    if (stream === null) {
      console.log(`  ⏭️  Sheet "${sheetName}" is empty, skipped`);
      continue;
    }

    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.end(resolve);
    });

    sheets.push({ sheetName, csvPath, rows });
    console.log(`  ✅ Sheet "${sheetName}": ${rows} rows staged`);
  }

  if (sheets.length === 0) {
    throw new Error('No readable sheets found in the workbook');
  }

  // A single-sheet workbook reads better as just the file name, matching how a
  // CSV upload is named. Multi-sheet workbooks qualify each table by its sheet.
  const used = new Set();
  for (const sheet of sheets) {
    const base = sheets.length === 1
      ? baseName
      : `${baseName}_${sanitizeIdentifier(sheet.sheetName)}`;
    // Two sheets can sanitise to the same identifier ("Q1 Sales" / "Q1-Sales").
    let tableName = base;
    let suffix = 2;
    while (used.has(tableName)) tableName = `${base}_${suffix++}`;
    used.add(tableName);
    sheet.tableName = tableName;
  }

  return sheets;
}

module.exports = { convertWorkbookToCSVs };
