// converter.service 以 spawn 风格调用 execFile（不传回调），靠子进程的 exit/error 事件
// 加上 90s 定时器 SIGKILL 超时；因此 mock 必须返回带 on/kill 的子进程对象
jest.mock('child_process', () => ({
  execFile: jest.fn(() => {
    const proc: any = {
      on: (evt: string, fn: (...a: any[]) => void) => {
        if (evt === 'exit') setTimeout(() => fn(0), 0);
        return proc;
      },
      kill: jest.fn()
    };
    return proc;
  })
}));
import { ConverterService } from '../src/modules/documents/converter.service';
import * as path from 'path';

describe('ConverterService', () => {
  afterEach(() => jest.clearAllMocks());

  it('copies pdf to preview dir without libreoffice', async () => {
    const job = { id: 'j1', documentVersionId: 'v1', status: 'pending' };
    const version = { id: 'v1', mimeType: 'application/pdf', filePath: '/tmp/a.pdf' };
    const fs = require('fs');
    const copySpy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => undefined);
    const service = new ConverterService(
      { save: jest.fn(async (x: any) => x), findOneBy: jest.fn(async () => job) } as any,
      { findOneBy: jest.fn(async () => version) } as any,
      '/tmp/previews'
    );
    await service.convert('j1');
    expect(require('child_process').execFile).not.toHaveBeenCalled();
    expect(copySpy).toHaveBeenCalledWith('/tmp/a.pdf', path.join('/tmp/previews', 'v1.pdf'));
    copySpy.mockRestore();
  });

  it('invokes libreoffice for office documents', async () => {
    const job = { id: 'j2', documentVersionId: 'v2', status: 'pending' };
    const version = { id: 'v2', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: '/tmp/a.docx' };
    const fs = require('fs');
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const readdirSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => []);
    const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => undefined);
    const service = new ConverterService(
      { save: jest.fn(async (x: any) => x), findOneBy: jest.fn(async () => job) } as any,
      { findOneBy: jest.fn(async () => version) } as any,
      '/tmp/previews'
    );
    await service.convert('j2');
    expect(require('child_process').execFile).toHaveBeenCalledWith(
      'libreoffice',
      expect.arrayContaining(['--headless', '--convert-to', 'pdf', '--outdir', '/tmp/previews', '/tmp/a.docx'])
    );
    mkdirSpy.mockRestore(); readdirSpy.mockRestore(); renameSpy.mockRestore();
  });
});