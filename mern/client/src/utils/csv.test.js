import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportCsv } from './csv.js';

let captured, clicked;
beforeEach(() => {
  captured = null; clicked = [];
  URL.createObjectURL = vi.fn(blob => { captured = blob; return 'blob:x'; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clicked.push({ href: this.href, download: this.download }); });
});
const read = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsText(blob); });
// FileReader strips a leading BOM when decoding, so inspect raw bytes for it.
const bytes = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(new Uint8Array(f.result)); f.readAsArrayBuffer(blob); });

describe('exportCsv', () => {
  const columns = [['name', 'Name'], ['ledger.gross', 'Gross']];
  it('writes header + rows with CRLF, quoting every cell', async () => {
    exportCsv([{ name: 'A', ledger: { gross: 5 } }, { name: 'B' }], columns, 'f.csv');
    const text = await read(captured);
    expect(text).toBe('"Name","Gross"\r\n"A","5"\r\n"B",""');
  });
  it('escapes embedded double quotes', async () => {
    exportCsv([{ name: 'He said "hi"' }], [['name', 'N']], 'f.csv');
    expect(await read(captured)).toContain('"He said ""hi"""');
  });
  it('starts with a UTF-8 BOM and the right MIME type', async () => {
    exportCsv([{ name: 'x' }], [['name', 'N']], 'f.csv');
    expect([...(await bytes(captured)).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(captured.type).toBe('text/csv;charset=utf-8');
  });
  it('preserves Gujarati text', async () => {
    exportCsv([{ name: 'ઘઉં' }], [['name', 'N']], 'f.csv');
    expect(await read(captured)).toContain('ઘઉં');
  });
  it('triggers a download with the filename and revokes the URL', () => {
    exportCsv([], [['a', 'A']], 'out.csv');
    expect(clicked).toEqual([{ href: expect.stringContaining('blob:x'), download: 'out.csv' }]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
  it('exports only the header when there are no rows', async () => {
    exportCsv([], [['a', 'A']], 'o.csv');
    expect(await read(captured)).toBe('"A"');
  });
  it('keeps 0 and false values (only null/undefined become empty)', async () => {
    exportCsv([{ a: 0, b: false }], [['a', 'A'], ['b', 'B']], 'o.csv');
    expect(await read(captured)).toContain('"0","false"');
  });
});
