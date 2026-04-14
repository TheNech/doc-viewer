export interface AnnotationStyle {
  fontSizePx: number;
  fontStyle: 'normal' | 'italic';
  fontWeight: 'normal' | 'bold';
  textDecoration: 'none' | 'underline';
}

export interface Annotation {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  style: AnnotationStyle;
}
