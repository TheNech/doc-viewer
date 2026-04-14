export interface DocumentPage {
  number: number;
  imageUrl: string;
}

export interface DocumentInfo {
  name: string;
  pages: DocumentPage[];
}
