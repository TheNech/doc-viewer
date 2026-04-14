import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DocumentInfo } from '../models/document.model';

@Injectable({
  providedIn: 'root',
})
export class DocumentApiService {
  private readonly http = inject(HttpClient);

  getDocument(documentId: string): Observable<DocumentInfo> {
    return this.http
      .get<DocumentInfo>(`assets/mocks/${documentId}.json`)
      .pipe(map((doc) => this.normalizeDocument(doc)));
  }

  private normalizeDocument(doc: DocumentInfo): DocumentInfo {
    return {
      ...doc,
      pages: doc.pages.map((p) => ({
        ...p,
        imageUrl: this.resolveImageUrl(p.imageUrl),
      })),
    };
  }

  private resolveImageUrl(imageUrl: string): string {
    if (/^https?:\/\//i.test(imageUrl)) {
      return imageUrl;
    }
    const path = imageUrl.replace(/^\//, '');
    return `/${path.startsWith('assets/') ? path : `assets/${path}`}`;
  }
}
