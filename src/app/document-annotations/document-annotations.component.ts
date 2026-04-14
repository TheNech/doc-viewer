import { CommonModule } from '@angular/common';
import {
  AfterRenderPhase,
  Component,
  ElementRef,
  afterRender,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AnnotationStyleControlsComponent } from '../annotation-style-controls/annotation-style-controls.component';
import { Annotation, AnnotationStyle } from '../models/annotation.model';
import { DocumentInfo } from '../models/document.model';

@Component({
  selector: 'app-document-annotations',
  standalone: true,
  imports: [CommonModule, AnnotationStyleControlsComponent],
  templateUrl: './document-annotations.component.html',
  styleUrl: './document-annotations.component.scss',
  host: {
    '[class.is-dragging-annotation]': 'isDraggingAnnotation()',
  },
})
export class DocumentAnnotationsComponent {
  document = input.required<DocumentInfo>();

  zoom = input.required<number>();

  placementMode = input.required<boolean>();

  isDrawing = input.required<boolean>();

  drawPreviewState = input.required<{
    pageNumber: number;
    box: { left: number; top: number; w: number; h: number };
  } | null>();

  pending = input<Annotation | null>(null);

  annotations = input.required<Annotation[]>();

  selectedAnnotationId = input.required<string | null>();

  chromeStyle = input.required<AnnotationStyle>();

  showPlacementHint = input.required<boolean>();

  showPendingHint = input.required<boolean>();

  isDraggingAnnotation = input.required<boolean>();

  firstPageLoaded = output<Event>();

  figureMouseDown = output<{
    pageNumber: number;
    event: MouseEvent;
  }>();

  figureClick = output<{
    pageNumber: number;
    event: MouseEvent;
  }>();
  discardPending = output<void>();

  fontSizeInput = output<Event>();

  toggleItalic = output<void>();

  toggleBold = output<void>();

  toggleUnderline = output<void>();

  startDrag = output<{ event: MouseEvent; ann: Annotation }>();

  savedAnnotationMouseDown = output<{
    event: MouseEvent;
    ann: Annotation;
  }>();

  annotationTextInput = output<{
    ann: Annotation;
    event: Event;
  }>();
  deleteAnnotation = output<string>();

  resizeHandleMouseDown = output<{
    event: MouseEvent;
    ann: Annotation;
    handle: string;
  }>();

  readonly resizeHandles = [
    'nw',
    'n',
    'ne',
    'e',
    'se',
    's',
    'sw',
    'w',
  ] as const;

  viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');

  activePageNumber = signal(1);

  constructor() {
    afterRender(
      () => {
        this.updateActivePageFromViewport();
      },
      { phase: AfterRenderPhase.Read },
    );
  }

  annotationsOnPage(pageNumber: number): Annotation[] {
    return this.annotations().filter((a) => a.pageNumber === pageNumber);
  }

  onViewportScroll(): void {
    this.updateActivePageFromViewport();
  }

  scrollToPage(pageNumber: number): void {
    const viewport = this.viewportRef()?.nativeElement;

    if (!viewport) {
      return;
    }

    const target = viewport.querySelector<HTMLElement>(
      `[data-doc-page="${pageNumber}"]`,
    );

    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private updateActivePageFromViewport(): void {
    const viewport = this.viewportRef()?.nativeElement;

    if (!viewport) {
      return;
    }

    const figures = viewport.querySelectorAll<HTMLElement>('[data-doc-page]');

    if (figures.length === 0) {
      return;
    }

    const vp = viewport.getBoundingClientRect();
    const vpCenterY = vp.top + vp.height / 2;
    let bestPage = 1;
    let bestScore = -1;

    figures.forEach((fig) => {
      const n = Number(fig.dataset['docPage']);
      const r = fig.getBoundingClientRect();
      const overlap = Math.max(
        0,
        Math.min(r.bottom, vp.bottom) - Math.max(r.top, vp.top),
      );
      const visibleRatio = overlap / Math.max(r.height, 1);
      const figCenterY = r.top + r.height / 2;
      const centerDist = Math.abs(figCenterY - vpCenterY);
      const score = visibleRatio * 1000 - centerDist * 0.02;

      if (score > bestScore) {
        bestScore = score;
        bestPage = n;
      }
    });

    if (bestPage !== this.activePageNumber()) {
      this.activePageNumber.set(bestPage);
    }
  }
}
