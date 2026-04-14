import { TestBed } from '@angular/core/testing';
import { Annotation } from '../models/annotation.model';
import { DocumentInfo } from '../models/document.model';
import { DocumentViewInteractionService } from './document-view-interaction.service';

function sampleAnnotation(overrides?: Partial<Annotation>): Annotation {
  return {
    id: 'ann-1',
    pageNumber: 1,
    x: 0.1,
    y: 0.1,
    w: 0.2,
    h: 0.2,
    text: 't',
    style: {
      fontSizePx: 16,
      fontStyle: 'normal',
      fontWeight: 'normal',
      textDecoration: 'none',
    },
    ...overrides,
  };
}

describe('DocumentViewInteractionService', () => {
  let service: DocumentViewInteractionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DocumentViewInteractionService],
    });
    service = TestBed.inject(DocumentViewInteractionService);
  });

  it('dispose не бросает', () => {
    expect(() => service.dispose()).not.toThrow();
  });

  describe('zoomIn / zoomOut', () => {
    it('zoomIn увеличивает зум в пределах maxZoom', () => {
      service.zoom.set(service.maxZoom - service.zoomStep * 2);
      service.zoomIn();
      expect(service.zoom()).toBeLessThanOrEqual(service.maxZoom);
      service.zoomIn();
      service.zoomIn();
      expect(service.zoom()).toBe(service.maxZoom);
    });

    it('zoomOut уменьшает зум в пределах minZoom', () => {
      service.zoom.set(service.minZoom + service.zoomStep * 2);
      service.zoomOut();
      expect(service.zoom()).toBeGreaterThanOrEqual(service.minZoom);
      service.zoom.set(service.minZoom + service.zoomStep * 0.5);
      service.zoomOut();
      expect(service.zoom()).toBe(service.minZoom);
    });
  });

  it('togglePlacementMode переключает режим и сбрасывает выделение при включении', () => {
    expect(service.placementMode()).toBe(false);
    service.selectedAnnotationId.set('ann-1');
    service.togglePlacementMode();
    expect(service.placementMode()).toBe(true);
    expect(service.selectedAnnotationId()).toBeNull();
    service.togglePlacementMode();
    expect(service.placementMode()).toBe(false);
  });

  it('selectedAnnotation возвращает null без выделения', () => {
    expect(service.selectedAnnotation()).toBeNull();
  });

  it('selectAnnotation выставляет id', () => {
    service.selectAnnotation('x');
    expect(service.selectedAnnotationId()).toBe('x');
  });

  it('setFontSizePx и переключатели стилей меняют newDefaults без выделения', () => {
    service.setFontSizePx(20);
    expect(service.newDefaults().fontSizePx).toBe(20);
    service.toggleItalic();
    expect(service.newDefaults().fontStyle).toBe('italic');
    service.toggleBold();
    expect(service.newDefaults().fontWeight).toBe('bold');
    service.toggleUnderline();
    expect(service.newDefaults().textDecoration).toBe('underline');
  });

  it('onFontSizeInput обновляет размер шрифта из input', () => {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '24';
    service.onFontSizeInput({ target: input } as unknown as Event);
    expect(service.newDefaults().fontSizePx).toBe(24);
  });

  it('commitPending переносит pending в annotations', () => {
    const pending: Annotation = sampleAnnotation({ id: 'p1', text: '' });
    service.pending.set(pending);
    service.commitPending();
    expect(service.pending()).toBeNull();
    expect(service.annotations().length).toBe(1);
    expect(service.annotations()[0].id).toBe('p1');
  });

  it('discardPending очищает pending', () => {
    service.pending.set(sampleAnnotation());
    service.discardPending();
    expect(service.pending()).toBeNull();
  });

  it('deleteAnnotation удаляет по id', () => {
    const a = sampleAnnotation({ id: 'del' });
    service.annotations.set([a]);
    service.deleteAnnotation('del');
    expect(service.annotations().length).toBe(0);
  });

  it('clearAllAnnotations очищает список и pending', () => {
    service.annotations.set([sampleAnnotation()]);
    service.pending.set(sampleAnnotation({ id: 'p' }));
    service.clearAllAnnotations();
    expect(service.annotations().length).toBe(0);
    expect(service.pending()).toBeNull();
  });

  it('undo откатывает к снимку после commitPending', () => {
    service.pending.set(sampleAnnotation({ id: 'c1' }));
    service.commitPending();
    expect(service.annotations().length).toBe(1);
    expect(service.canUndo()).toBe(true);
    service.undo();
    expect(service.annotations().length).toBe(0);
    expect(service.canUndo()).toBe(false);
  });

  it('undo при пустом стеке не падает', () => {
    expect(service.canUndo()).toBe(false);
    expect(() => service.undo()).not.toThrow();
  });

  it('onAnnotationTextInput обновляет текст аннотации', () => {
    const ann = sampleAnnotation({ id: 't1' });
    service.annotations.set([ann]);
    const ta = document.createElement('textarea');
    ta.value = 'hello';
    service.onAnnotationTextInput(ann, { target: ta } as unknown as Event);
    expect(service.annotations().find((x) => x.id === 't1')!.text).toBe(
      'hello',
    );
  });

  it('saveToConsole вызывает console.log с payload', () => {
    spyOn(console, 'log');
    const doc: DocumentInfo = { name: 'D', pages: [] };
    service.annotations.set([sampleAnnotation()]);
    service.saveToConsole('id-1', doc);
    expect(console.log).toHaveBeenCalled();
    const arg = (console.log as jasmine.Spy).calls.mostRecent().args[0];
    expect(arg).toContain('id-1');
    expect(arg).toContain('annotations');
  });

  it('saveToConsole не логирует при document === null', () => {
    spyOn(console, 'log');
    service.saveToConsole('x', null);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('onDocumentKeydown Escape сбрасывает pending', () => {
    service.pending.set(sampleAnnotation());
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    spyOn(ev, 'preventDefault');
    service.onDocumentKeydown(ev);
    expect(service.pending()).toBeNull();
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it('onFirstPageLoaded подстраивает zoom под размеры viewport и изображения', () => {
    const viewport = document.createElement('div');
    viewport.className = 'viewport';
    Object.defineProperty(viewport, 'clientWidth', {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(viewport, 'clientHeight', {
      value: 300,
      configurable: true,
    });
    const img = document.createElement('img');
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true });
    viewport.appendChild(img);
    document.body.appendChild(viewport);

    service.onFirstPageLoaded({ target: img } as unknown as Event);

    expect(service.zoom()).toBeGreaterThan(service.minZoom);
    expect(service.zoom()).toBeLessThanOrEqual(1);

    document.body.removeChild(viewport);
  });
});
