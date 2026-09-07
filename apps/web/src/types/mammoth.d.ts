declare module 'mammoth/mammoth.browser' {
  export interface ConvertResult { value: string; messages: any[] }
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer } | { path: string }): Promise<ConvertResult>;
  const _default: { convertToHtml: typeof convertToHtml };
  export default _default;
}
