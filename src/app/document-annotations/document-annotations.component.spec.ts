import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Annotation } from '../models/annotation.model';
import { DocumentInfo } from '../models/document.model';
import { DocumentAnnotationsComponent } from './document-annotations.component';

describe('DocumentAnnotationsComponent', () => {
  let fixture: ComponentFixture<DocumentAnnotationsComponent>;
  let component: DocumentAnnotationsComponent;

  const doc: DocumentInfo = {
    name: 'D',
    pages: [
      { number: 1, imageUrl: '/assets/p1.png' },
      { number: 2, imageUrl: '/assets/p2.png' },
    ],
  };

  const baseStyle = {
    fontSizePx: 16,
    fontStyle: 'normal' as const,
    fontWeight: 'normal' as const,
    textDecoration: 'none' as const,
  };

  const ann1: Annotation = {
    id: 'a1',
    pageNumber: 1,
    x: 0,
    y: 0,
    w: 0.1,
    h: 0.1,
    text: '',
    style: { ...baseStyle },
  };

  const ann2: Annotation = {
    id: 'a2',
    pageNumber: 2,
    x: 0,
    y: 0,
    w: 0.1,
    h: 0.1,
    text: '',
    style: { ...baseStyle },
  };

  function setInputs(): void {
    fixture.componentRef.setInput('document', doc);
    fixture.componentRef.setInput('zoom', 1);
    fixture.componentRef.setInput('placementMode', false);
    fixture.componentRef.setInput('isDrawing', false);
    fixture.componentRef.setInput('drawPreviewState', null);
    fixture.componentRef.setInput('pending', null);
    fixture.componentRef.setInput('annotations', [ann1, ann2]);
    fixture.componentRef.setInput('selectedAnnotationId', null);
    fixture.componentRef.setInput('chromeStyle', baseStyle);
    fixture.componentRef.setInput('showPlacementHint', false);
    fixture.componentRef.setInput('showPendingHint', false);
    fixture.componentRef.setInput('isDraggingAnnotation', false);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentAnnotationsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentAnnotationsComponent);
    component = fixture.componentInstance;
    setInputs();
    fixture.detectChanges();
  });

  it('создаётся', () => {
    expect(component).toBeTruthy();
  });

  it('annotationsOnPage фильтрует по номеру страницы', () => {
    expect(component.annotationsOnPage(1).map((a) => a.id)).toEqual(['a1']);
    expect(component.annotationsOnPage(2).map((a) => a.id)).toEqual(['a2']);
    expect(component.annotationsOnPage(3)).toEqual([]);
  });

  it('рендерит viewport и миниатюры страниц', () => {
    expect(fixture.nativeElement.querySelector('.viewport')).toBeTruthy();
    const thumbs = fixture.nativeElement.querySelectorAll('.page-thumb');
    expect(thumbs.length).toBe(2);
  });

  it('scrollToPage не падает при отсутствии элемента', () => {
    expect(() => component.scrollToPage(99)).not.toThrow();
  });

  it('клик по миниатюре вызывает scrollToPage', () => {
    spyOn(component, 'scrollToPage');
    const thumb = fixture.nativeElement.querySelector(
      '.page-thumb',
    ) as HTMLButtonElement;
    thumb.click();
    expect(component.scrollToPage).toHaveBeenCalledWith(1);
  });
});
