const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const excelPath = path.resolve(__dirname, '..', 'Data', 'northwind.xlsx');
const workbook = XLSX.readFile(excelPath, { cellDates: true });

console.log('--- SHEETS IN NORTHWIND.XLSX ---');
console.log(workbook.SheetNames);

const report = {};

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const rowCount = data.length;
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  
  // Analyze column types and null counts
  const colAnalysis = {};
  columns.forEach(col => {
    let nullCount = 0;
    const types = new Set();
    const samples = [];
    data.forEach(row => {
      const val = row[col];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      } else {
        types.add(typeof val + (val instanceof Date ? ' (Date)' : ''));
        if (samples.length < 3) samples.push(val);
      }
    });
    colAnalysis[col] = {
      types: Array.from(types),
      nullCount,
      uniqueCount: new Set(data.map(r => r[col])).size,
      samples
    };
  });

  report[sheetName] = {
    rowCount,
    columns,
    colAnalysis
  };
});

fs.writeFileSync('inspection_report.json', JSON.stringify(report, null, 2));
console.log('Inspection report saved to inspection_report.json');
Object.keys(report).forEach(s => {
  console.log(`Sheet: ${s} | Rows: ${report[s].rowCount} | Cols: ${report[s].columns.length}`);
  console.log('Columns:', report[s].columns.join(', '));
});
