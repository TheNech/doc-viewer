import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocumentAnnotationsComponent } from '../document-annotations/document-annotations.component';
import { DocumentHeaderComponent } from '../document-header/document-header.component';
import { DocumentInfo } from '../models/document.model';
import { DocumentApiService } from '../services/document-api.service';
import { DocumentViewInteractionService } from '../services/document-view-interaction.service';

@Component({
  selector: 'app-document-view',
  standalone: true,
  imports: [
    CommonModule,
    DocumentHeaderComponent,
    DocumentAnnotationsComponent,
  ],
  templateUrl: './document-view.component.html',
  styleUrl: './document-view.component.scss',
  providers: [DocumentViewInteractionService],
})
export class DocumentViewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly documentApi = inject(DocumentApiService);
  readonly interaction = inject(DocumentViewInteractionService);

  documentId = '';

  document: DocumentInfo | null = null;

  error: string | null = null;

  loading = true;

  ngOnInit(): void {
    this.documentId = this.route.snapshot.paramMap.get('id') ?? '';

    if (!this.documentId) {
      this.loading = false;
      this.error = 'Не указан id документа';

      return;
    }

    this.documentApi.getDocument(this.documentId).subscribe({
      next: (doc) => {
        this.document = doc;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить документ';
        this.loading = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.interaction.dispose();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent): void {
    this.interaction.onDocumentKeydown(ev);
  }
}
