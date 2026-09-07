import { useEffect, useState } from 'react';
import { Alert, Empty, Segmented, Space, Spin, Tabs, Typography } from 'antd';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth/mammoth.browser';

type Kind = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

function extOf(name: string): string {
  const i = (name || '').lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function isOffice(name: string, mime: string): boolean {
  const e = extOf(name);
  if ([ 'xlsx', 'xls', 'xlsm', 'ods', 'docx', 'doc', 'odt' ].includes(e)) return true;
  return /(spreadsheet|wordprocessing|ms-excel|msword|opendocument)/i.test(mime || '');
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try { return String((v as any).w ?? (v as any).v ?? ''); } catch { return ''; }
  }
  return String(v);
}

function aoaToTable(aoa: unknown[][]): { __html: string } {
  const rows = aoa.map((r) => '<tr>' + r.map((c) => '<td>' + renderCell(c).replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</td>').join('') + '</tr>').join('');
  return { __html: '<table class= op-sheet>' + rows + '</table>' };
}

export function OfficePreview({ blob, fileName, mimeType }: { blob: Blob; fileName: string; mimeType: string }) {
  const [kind, setKind] = useState<Kind>('idle');
  const [html, setHtml] = useState<string>('');
  const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
  const [active, setActive] = useState<string>('');
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setKind('loading');
    setHtml('');
    setSheets([]);
    setErr('');
    const ext = extOf(fileName);
    const isXls = [ 'xlsx', 'xls', 'xlsm', 'ods' ].includes(ext);
    const isDoc = [ 'docx', 'doc', 'odt' ].includes(ext);

    (async () => {
      try {
        if (isOffice(fileName, mimeType) && !isXls && !isDoc) {
          setKind('unsupported');
          return;
        }
        if (isXls) {
          const buf = await blob.arrayBuffer();
          const wb = XLSX.read(buf, { type: 'array' });
          const list = wb.SheetNames.map((name) => {
            const sheet = wb.Sheets[name];
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false }) as unknown[][];
            return { name, html: aoaToTable(aoa).__html };
          });
          if (cancelled) return;
          setSheets(list);
          setActive(list[0]?.name || '');
          setKind('ready');
        } else if (isDoc) {
          const buf = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (cancelled) return;
          setHtml(result.value || '<p>(空文档)</p>');
          setKind('ready');
        } else {
          setKind('unsupported');
        }
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message || String(e));
        setKind('error');
      }
    })();
    return () => { cancelled = true; };
  }, [blob, fileName, mimeType]);

  if (kind === 'loading') return <div style={{ textAlign: 'center', padding: 80 }}><Spin tip='' />; </div>;
  if (kind === 'unsupported') return <Empty description='' />;
  if (kind === 'error') return <Alert type='error' message='' description={err} showIcon />;
  if (kind === 'ready' && sheets.length > 0) {
    const cur = sheets.find((s) => s.name === active) || sheets[0];
    return (
      <div className='op-wrap'>
        <Tabs activeKey={active} onChange={setActive} items={sheets.map((s) => ({ key: s.name, label: s.name }))} />
        <div className='op-sheet-scroll'>
          <div className='op-sheet-table'>
            <div dangerouslySetInnerHTML={{ __html: cur.html }} />
          </div>
        </div>
        <style>{'.op-wrap{display:flex;flex-direction:column;height:60vh}.op-sheet-scroll{flex:1;overflow:auto;border:1px solid #e5e7eb;border-radius:6px}.op-sheet-table{padding:8px}.op-sheet{border-collapse:collapse;font-size:12px}.op-sheet td{border:1px solid #e5e7eb;padding:4px 8px;white-space:pre;min-width:48px;max-width:320px;overflow:hidden;text-overflow:ellipsis}'}</style>
      </div>
    );
  }
  if (kind === 'ready') {
    return (
      <div className='op-doc'>
        <div className='op-doc-scroll'>
          <div className='op-doc-body' dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <style>{'.op-doc{display:flex;flex-direction:column;height:60vh}.op-doc-scroll{flex:1;overflow:auto;padding:24px 32px;background:#fff;border:1px solid #e5e7eb;border-radius:6px}.op-doc-body{font-size:14px;line-height:1.7;color:#0f172a;max-width:780px;margin:0 auto}.op-doc-body h1{font-size:22px;margin:0.8em 0 0.4em}.op-doc-body h2{font-size:18px;margin:0.7em 0 0.3em}.op-doc-body h3{font-size:16px;margin:0.6em 0 0.3em}.op-doc-body p{margin:0.6em 0}.op-doc-body ul,.op-doc-body ol{padding-left:1.5em}.op-doc-body table{border-collapse:collapse;margin:0.6em 0}.op-doc-body table td,.op-doc-body table th{border:1px solid #e5e7eb;padding:4px 8px}'}</style>
      </div>
    );
  }
  return null;
}
