declare module "word-extractor" {
  type WordDocument = {
    getBody(options?: { filterUnicode?: boolean }): string;
    getHeaders(options?: { includeFooters?: boolean; filterUnicode?: boolean }): string;
    getFooters(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getAnnotations(): string;
    getTextboxes(): string;
  };
  export default class WordExtractor { extract(buffer: Buffer): Promise<WordDocument>; }
}
