import { Injectable, computed, signal } from '@angular/core';
import { Annotation, AnnotationStyle } from '../models/annotation.model';
import { DocumentInfo } from '../models/document.model';

const UNDO_LIMIT = 50;
const MIN_DRAW_REL = 0.02;
const DRAG_THRESHOLD_PX = 5;

type AnnotationResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

function isResizeHandle(h: string): h is AnnotationResizeHandle {
  return (
    h === 'nw' ||
    h === 'n' ||
    h === 'ne' ||
    h === 'e' ||
    h === 'se' ||
    h === 's' ||
    h === 'sw' ||
    h === 'w'
  );
}

@Injectable()
export class DocumentViewInteractionService {
  readonly minZoom = 0.25;
  readonly maxZoom = 3;
  readonly zoomStep = 0.1;

  readonly zoom = signal(0.35);

  private initialZoomApplied = false;

  readonly annotations = signal<Annotation[]>([]);

  readonly newDefaults = signal<AnnotationStyle>({
    fontSizePx: 16,
    fontStyle: 'normal',
    fontWeight: 'normal',
    textDecoration: 'none',
  });

  readonly selectedAnnotationId = signal<string | null>(null);

  readonly placementMode = signal(false);

  readonly isDrawing = signal(false);

  readonly drawPageNumber = signal<number | null>(null);

  private drawFigure: HTMLElement | null = null;

  readonly drawStart = signal({ x: 0, y: 0 });

  readonly drawCurrent = signal({ x: 0, y: 0 });

  readonly pending = signal<Annotation | null>(null);

  private readonly undoStack = signal<Annotation[][]>([]);

  readonly canUndo = computed(() => this.undoStack().length > 0);

  readonly currentStyle = computed((): AnnotationStyle => {
    const pending = this.pending();

    if (pending) {
      return pending.style;
    }

    const id = this.selectedAnnotationId();

    if (id) {
      const ann = this.annotations().find((a) => a.id === id);

      if (ann) {
        return ann.style;
      }
    }

    return this.newDefaults();
  });

  readonly drawPreviewState = computed(() => {
    if (!this.isDrawing() || this.drawPageNumber() === null) {
      return null;
    }

    const box = this.drawPreviewBox();

    if (!box) {
      return null;
    }

    return { pageNumber: this.drawPageNumber()!, box };
  });

  private boundMove?: (e: MouseEvent) => void;

  private boundUp?: (e: MouseEvent) => void;

  private ignoreBackgroundCommitUntil = 0;

  private readonly dragAnnotationState = signal<{
    ann: Annotation;
    figureEl: HTMLElement;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  private dragBoundMove?: (e: MouseEvent) => void;

  private dragBoundUp?: (e: MouseEvent) => void;

  private readonly resizeAnnotationState = signal<{
    ann: Annotation;
    figureEl: HTMLElement;
    handle: AnnotationResizeHandle;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  private resizeBoundMove?: (e: MouseEvent) => void;

  private resizeBoundUp?: (e: MouseEvent) => void;

  readonly isDraggingAnnotation = computed(
    () =>
      this.dragAnnotationState() !== null ||
      this.resizeAnnotationState() !== null,
  );

  private pointerDecision: {
    ann: Annotation;
    figureEl: HTMLElement;
    startClientX: number;
    startClientY: number;
  } | null = null;

  private pointerDecMove?: (e: MouseEvent) => void;

  private pointerDecUp?: (e: MouseEvent) => void;

  dispose(): void {
    this.unbindDrawListeners();
    this.unbindDragAnnotationListeners();
    this.unbindResizeListeners();
    this.unbindPointerDecision();
  }

  onDocumentKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' && this.pending()) {
      ev.preventDefault();
      this.discardPending();

      return;
    }

    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      this.undo();
    }
  }

  onAnnotationsFigureMouseDown(payload: {
    pageNumber: number;
    event: MouseEvent;
  }): void {
    this.onFigureMouseDown(payload.event, payload.pageNumber);
  }

  onAnnotationsFigureClick(payload: {
    pageNumber: number;
    event: MouseEvent;
  }): void {
    this.onFigureClick(payload.event);
  }

  onResizeHandleMouseDown(payload: {
    event: MouseEvent;
    ann: Annotation;
    handle: string;
  }): void {
    const { event, ann, handle } = payload;

    event.preventDefault();
    event.stopPropagation();

    if (!isResizeHandle(handle)) {
      return;
    }

    if (
      this.isDrawing() ||
      this.dragAnnotationState() ||
      this.resizeAnnotationState()
    ) {
      return;
    }

    const figure = (event.target as HTMLElement).closest('figure.page');

    if (!(figure instanceof HTMLElement)) {
      return;
    }

    this.beginResize(ann, figure, handle, event.clientX, event.clientY);
  }

  selectedAnnotation(): Annotation | null {
    const id = this.selectedAnnotationId();

    if (!id) {
      return null;
    }

    return this.annotations().find((a) => a.id === id) ?? null;
  }

  private patchStyle(partial: Partial<AnnotationStyle>): void {
    const pend = this.pending();

    if (pend) {
      this.pending.set({
        ...pend,
        style: { ...pend.style, ...partial },
      });

      return;
    }

    const ann = this.selectedAnnotation();

    if (ann) {
      this.annotations.update((arr) =>
        arr.map((a) =>
          a.id === ann.id ? { ...a, style: { ...a.style, ...partial } } : a,
        ),
      );
    } else {
      this.newDefaults.update((d) => ({ ...d, ...partial }));
    }
  }

  setFontSizePx(value: number): void {
    const v = Math.round(
      Math.min(96, Math.max(8, Number.isFinite(value) ? value : 16)),
    );
    this.patchStyle({ fontSizePx: v });
  }

  toggleItalic(): void {
    const s = this.currentStyle();
    this.patchStyle({
      fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic',
    });
  }

  toggleBold(): void {
    const s = this.currentStyle();
    this.patchStyle({
      fontWeight: s.fontWeight === 'bold' ? 'normal' : 'bold',
    });
  }

  toggleUnderline(): void {
    const s = this.currentStyle();
    this.patchStyle({
      textDecoration: s.textDecoration === 'underline' ? 'none' : 'underline',
    });
  }

  onFontSizeInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.setFontSizePx(parseInt(raw, 10));
  }

  togglePlacementMode(): void {
    const next = !this.placementMode();
    this.placementMode.set(next);

    if (next) {
      this.selectedAnnotationId.set(null);
    }
  }

  onSavedAnnotationMouseDown(event: MouseEvent, ann: Annotation): void {
    event.stopPropagation();

    if (
      this.isDrawing() ||
      this.dragAnnotationState() ||
      this.resizeAnnotationState()
    ) {
      return;
    }

    if (this.pending()) {
      this.commitPending();
    }

    const t = event.target as HTMLElement;
    const selected = this.selectedAnnotationId() === ann.id;

    if (selected) {
      if (t.tagName === 'TEXTAREA') {
        return;
      }

      if (t.closest('.annotation-chrome') && !t.closest('.annotation-drag')) {
        return;
      }

      if (t.closest('.annotation-drag')) {
        event.preventDefault();
        const figure = (event.currentTarget as HTMLElement).closest('.page');

        if (figure instanceof HTMLElement) {
          this.beginDrag(ann, figure, event.clientX, event.clientY);
        }
      }

      return;
    }

    const figure = (event.currentTarget as HTMLElement).closest('.page');

    if (!(figure instanceof HTMLElement)) {
      return;
    }

    this.pointerDecision = {
      ann,
      figureEl: figure,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    this.pointerDecMove = (e: MouseEvent) => this.onPointerDecisionMove(e);
    this.pointerDecUp = (e: MouseEvent) => this.onPointerDecisionUp(e);

    document.addEventListener('mousemove', this.pointerDecMove);
    document.addEventListener('mouseup', this.pointerDecUp);
    event.preventDefault();
  }

  private onPointerDecisionMove(event: MouseEvent): void {
    const pd = this.pointerDecision;

    if (!pd || this.dragAnnotationState() || this.resizeAnnotationState()) {
      return;
    }

    const dx = event.clientX - pd.startClientX;
    const dy = event.clientY - pd.startClientY;

    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      return;
    }

    const { ann, figureEl, startClientX, startClientY } = pd;

    this.unbindPointerDecision();
    this.beginDrag(ann, figureEl, startClientX, startClientY);
    this.onDragAnnotationMove(event);
  }

  private onPointerDecisionUp(_event: MouseEvent): void {
    const pd = this.pointerDecision;

    if (!pd) {
      return;
    }

    this.unbindPointerDecision();

    if (!this.dragAnnotationState()) {
      this.selectAnnotation(pd.ann.id);
    }
  }

  private unbindPointerDecision(): void {
    if (this.pointerDecMove) {
      document.removeEventListener('mousemove', this.pointerDecMove);
    }

    if (this.pointerDecUp) {
      document.removeEventListener('mouseup', this.pointerDecUp);
    }

    this.pointerDecMove = undefined;
    this.pointerDecUp = undefined;
    this.pointerDecision = null;
  }

  startDragAnnotation(event: MouseEvent, ann: Annotation): void {
    event.preventDefault();
    event.stopPropagation();

    const figure = (event.currentTarget as HTMLElement).closest('.page');

    if (!(figure instanceof HTMLElement)) {
      return;
    }

    this.beginDrag(ann, figure, event.clientX, event.clientY);
  }

  private beginDrag(
    ann: Annotation,
    figureEl: HTMLElement,
    clientX: number,
    clientY: number,
  ): void {
    if (
      this.isDrawing() ||
      this.dragAnnotationState() ||
      this.resizeAnnotationState()
    ) {
      return;
    }

    if (this.pending() !== ann) {
      this.pushUndoSnapshot();
    }

    this.dragAnnotationState.set({
      ann,
      figureEl,
      startClientX: clientX,
      startClientY: clientY,
      origX: ann.x,
      origY: ann.y,
    });

    this.dragBoundMove = (e: MouseEvent) => this.onDragAnnotationMove(e);
    this.dragBoundUp = () => this.onDragAnnotationUp();

    document.addEventListener('mousemove', this.dragBoundMove);
    document.addEventListener('mouseup', this.dragBoundUp);
  }

  private onDragAnnotationMove(event: MouseEvent): void {
    const st = this.dragAnnotationState();

    if (!st) {
      return;
    }

    const fs = st.figureEl.getBoundingClientRect();
    const fw = fs.width || 1;
    const fh = fs.height || 1;
    const dx = (event.clientX - st.startClientX) / fw;
    const dy = (event.clientY - st.startClientY) / fh;
    const ann = st.ann;
    let nx = st.origX + dx;
    let ny = st.origY + dy;
    nx = Math.min(Math.max(0, nx), 1 - ann.w);
    ny = Math.min(Math.max(0, ny), 1 - ann.h);

    this.annotations.update((arr) =>
      arr.map((item) =>
        item.id === ann.id ? { ...item, x: nx, y: ny } : item,
      ),
    );
  }

  private onDragAnnotationUp(): void {
    this.unbindDragAnnotationListeners();
    this.ignoreBackgroundCommitUntil = Date.now() + 200;
  }

  private unbindDragAnnotationListeners(): void {
    if (this.dragBoundMove) {
      document.removeEventListener('mousemove', this.dragBoundMove);
    }

    if (this.dragBoundUp) {
      document.removeEventListener('mouseup', this.dragBoundUp);
    }

    this.dragBoundMove = undefined;
    this.dragBoundUp = undefined;
    this.dragAnnotationState.set(null);
  }

  private beginResize(
    ann: Annotation,
    figureEl: HTMLElement,
    handle: AnnotationResizeHandle,
    clientX: number,
    clientY: number,
  ): void {
    if (this.pending() !== ann) {
      this.pushUndoSnapshot();
    }

    this.resizeAnnotationState.set({
      ann,
      figureEl,
      handle,
      startClientX: clientX,
      startClientY: clientY,
      origX: ann.x,
      origY: ann.y,
      origW: ann.w,
      origH: ann.h,
    });
    this.resizeBoundMove = (e: MouseEvent) => this.onResizeAnnotationMove(e);
    this.resizeBoundUp = () => this.onResizeAnnotationUp();

    document.addEventListener('mousemove', this.resizeBoundMove);
    document.addEventListener('mouseup', this.resizeBoundUp);
  }

  private onResizeAnnotationMove(event: MouseEvent): void {
    const st = this.resizeAnnotationState();

    if (!st) {
      return;
    }

    const fs = st.figureEl.getBoundingClientRect();
    const fw = fs.width || 1;
    const fh = fs.height || 1;
    const dxn = (event.clientX - st.startClientX) / fw;
    const dyn = (event.clientY - st.startClientY) / fh;
    const { x, y, w, h } = this.applyResizeDelta(
      st.handle,
      st.origX,
      st.origY,
      st.origW,
      st.origH,
      dxn,
      dyn,
    );

    const annId = st.ann.id;

    this.annotations.update((arr) =>
      arr.map((item) =>
        item.id === annId ? { ...item, x, y, w, h } : item,
      ),
    );
  }

  private applyResizeDelta(
    handle: AnnotationResizeHandle,
    ox: number,
    oy: number,
    ow: number,
    oh: number,
    dxn: number,
    dyn: number,
  ): { x: number; y: number; w: number; h: number } {
    const MIN = MIN_DRAW_REL;
    let x = ox;
    let y = oy;
    let w = ow;
    let h = oh;

    switch (handle) {
      case 'e':
        w = Math.max(MIN, Math.min(ow + dxn, 1 - ox));
        break;
      case 'w': {
        const nx = Math.min(Math.max(0, ox + dxn), ox + ow - MIN);
        w = ox + ow - nx;
        x = nx;
        break;
      }
      case 's':
        h = Math.max(MIN, Math.min(oh + dyn, 1 - oy));
        break;
      case 'n': {
        const ny = Math.min(Math.max(0, oy + dyn), oy + oh - MIN);
        h = oy + oh - ny;
        y = ny;
        break;
      }
      case 'se':
        w = Math.max(MIN, Math.min(ow + dxn, 1 - ox));
        h = Math.max(MIN, Math.min(oh + dyn, 1 - oy));
        break;
      case 'sw': {
        const nx = Math.min(Math.max(0, ox + dxn), ox + ow - MIN);
        w = ox + ow - nx;
        x = nx;
        h = Math.max(MIN, Math.min(oh + dyn, 1 - oy));
        break;
      }
      case 'ne': {
        const ny = Math.min(Math.max(0, oy + dyn), oy + oh - MIN);
        h = oy + oh - ny;
        y = ny;
        w = Math.max(MIN, Math.min(ow + dxn, 1 - ox));
        break;
      }
      case 'nw': {
        const nx = Math.min(Math.max(0, ox + dxn), ox + ow - MIN);
        w = ox + ow - nx;
        x = nx;
        const ny = Math.min(Math.max(0, oy + dyn), oy + oh - MIN);
        h = oy + oh - ny;
        y = ny;
        break;
      }
    }

    if (x + w > 1) {
      w = 1 - x;
    }

    if (y + h > 1) {
      h = 1 - y;
    }
    w = Math.max(MIN, w);
    h = Math.max(MIN, h);

    return { x, y, w, h };
  }

  private onResizeAnnotationUp(): void {
    this.unbindResizeListeners();
    this.ignoreBackgroundCommitUntil = Date.now() + 200;
  }

  private unbindResizeListeners(): void {
    if (this.resizeBoundMove) {
      document.removeEventListener('mousemove', this.resizeBoundMove);
    }

    if (this.resizeBoundUp) {
      document.removeEventListener('mouseup', this.resizeBoundUp);
    }

    this.resizeBoundMove = undefined;
    this.resizeBoundUp = undefined;
    this.resizeAnnotationState.set(null);
  }

  private onFigureMouseDown(event: MouseEvent, pageNumber: number): void {
    if (
      this.isDrawing() ||
      this.dragAnnotationState() ||
      this.resizeAnnotationState()
    ) {
      return;
    }

    if (!this.placementMode()) {
      return;
    }

    const t = event.target as HTMLElement;

    if (t.closest('.annotation-box')) {
      return;
    }

    if (this.pending()) {
      this.commitPending();
    }

    if (t.closest('.draw-preview')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.selectedAnnotationId.set(null);
    this.isDrawing.set(true);
    this.drawPageNumber.set(pageNumber);
    this.drawFigure = event.currentTarget as HTMLElement;
    const rect = this.drawFigure.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / (rect.width || 1);
    const ny = (event.clientY - rect.top) / (rect.height || 1);
    const p = { x: nx, y: ny };
    this.drawStart.set(p);
    this.drawCurrent.set(p);

    this.bindDrawListeners();
  }

  private bindDrawListeners(): void {
    this.unbindDrawListeners();
    this.boundMove = (e: MouseEvent) => this.onDocumentMouseMove(e);
    this.boundUp = (e: MouseEvent) => this.onDocumentMouseUp(e);

    document.addEventListener('mousemove', this.boundMove);
    document.addEventListener('mouseup', this.boundUp);
  }

  private unbindDrawListeners(): void {
    if (this.boundMove) {
      document.removeEventListener('mousemove', this.boundMove);
    }

    if (this.boundUp) {
      document.removeEventListener('mouseup', this.boundUp);
    }

    this.boundMove = undefined;
    this.boundUp = undefined;
  }

  private onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isDrawing() || !this.drawFigure) {
      return;
    }

    const rect = this.drawFigure.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / (rect.width || 1);
    const ny = (event.clientY - rect.top) / (rect.height || 1);
    this.drawCurrent.set({ x: nx, y: ny });
  }

  private onDocumentMouseUp(_event: MouseEvent): void {
    if (!this.isDrawing() || this.drawPageNumber() === null || !this.drawFigure) {
      this.finishDrawCleanup();

      return;
    }

    const x1 = this.drawStart().x;
    const y1 = this.drawStart().y;
    const x2 = this.drawCurrent().x;
    const y2 = this.drawCurrent().y;
    let x = Math.min(x1, x2);
    let y = Math.min(y1, y2);
    let w = Math.abs(x2 - x1);
    let h = Math.abs(y2 - y1);
    x = this.clamp01(x);
    y = this.clamp01(y);

    if (x + w > 1) {
      w = 1 - x;
    }

    if (y + h > 1) {
      h = 1 - y;
    }

    this.unbindDrawListeners();
    this.isDrawing.set(false);
    this.drawFigure = null;

    if (w < MIN_DRAW_REL || h < MIN_DRAW_REL) {
      this.drawPageNumber.set(null);

      return;
    }

    const pageNum = this.drawPageNumber();
    this.pending.set({
      id: crypto.randomUUID(),
      pageNumber: pageNum!,
      x,
      y,
      w,
      h,
      text: '',
      style: { ...this.newDefaults() },
    });
    this.drawPageNumber.set(null);
    this.placementMode.set(false);
    this.ignoreBackgroundCommitUntil = Date.now() + 200;
  }

  private finishDrawCleanup(): void {
    this.unbindDrawListeners();

    this.isDrawing.set(false);
    this.drawFigure = null;
    this.drawPageNumber.set(null);
  }

  private drawPreviewBox(): {
    left: number;
    top: number;
    w: number;
    h: number;
  } | null {
    if (!this.isDrawing() || this.drawPageNumber() === null) {
      return null;
    }

    const x1 = this.drawStart().x;
    const y1 = this.drawStart().y;
    const x2 = this.drawCurrent().x;
    const y2 = this.drawCurrent().y;
    let left = Math.min(x1, x2);
    let top = Math.min(y1, y2);
    let w = Math.abs(x2 - x1);
    let h = Math.abs(y2 - y1);
    left = this.clamp01(left);
    top = this.clamp01(top);

    if (left + w > 1) {
      w = 1 - left;
    }

    if (top + h > 1) {
      h = 1 - top;
    }

    return { left, top, w, h };
  }

  private onFigureClick(event: MouseEvent): void {
    event.stopPropagation();

    const t = event.target as HTMLElement;

    if (t.closest('.annotation-box')) {
      return;
    }

    if (this.pending()) {
      if (t.tagName === 'IMG') {
        if (Date.now() < this.ignoreBackgroundCommitUntil) {
          return;
        }

        this.commitPending();
      }

      return;
    }
    this.selectedAnnotationId.set(null);
  }

  selectAnnotation(id: string, event?: Event): void {
    event?.stopPropagation();

    if (this.pending()) {
      this.commitPending();
    }

    this.selectedAnnotationId.set(id);
  }

  commitPending(): void {
    const p = this.pending();

    if (!p) {
      return;
    }

    this.pushUndoSnapshot();
    this.annotations.update((anns) => [
      ...anns,
      { ...p, style: { ...p.style } },
    ]);
    this.pending.set(null);
    this.selectedAnnotationId.set(null);
  }

  discardPending(): void {
    this.pending.set(null);
  }

  deleteAnnotation(id: string, event?: Event): void {
    event?.stopPropagation();
    this.pushUndoSnapshot();
    this.annotations.update((anns) => anns.filter((a) => a.id !== id));

    if (this.selectedAnnotationId() === id) {
      this.selectedAnnotationId.set(null);
    }
  }

  clearAllAnnotations(): void {
    if (this.annotations().length === 0 && !this.pending()) {
      return;
    }

    this.pushUndoSnapshot();
    this.annotations.set([]);
    this.selectedAnnotationId.set(null);
    this.discardPending();
  }

  undo(): void {
    this.undoStack.update((stack) => {
      if (stack.length === 0) {
        return stack;
      }

      const prev = stack[stack.length - 1];
      const next = stack.slice(0, -1);

      this.annotations.set(
        prev.map((a) => ({
          ...a,
          style: { ...a.style },
        })),
      );
      this.selectedAnnotationId.set(null);
      this.pending.set(null);

      return next;
    });
  }

  private pushUndoSnapshot(): void {
    const snap = this.annotations().map((a) => ({
      ...a,
      style: { ...a.style },
    }));

    this.undoStack.update((stack) => {
      const next = [...stack, snap];

      if (next.length > UNDO_LIMIT) {
        next.shift();
      }

      return next;
    });
  }

  onAnnotationTextInput(ann: Annotation, event: Event): void {
    const el = event.target;

    if (el instanceof HTMLTextAreaElement) {
      const v = el.value;

      this.annotations.update((arr) =>
        arr.map((item) =>
          item.id === ann.id ? { ...item, text: v } : item,
        ),
      );
    }
  }

  saveToConsole(documentId: string, document: DocumentInfo | null): void {
    if (!document) {
      return;
    }

    const payload = {
      documentId,
      document,
      annotations: this.annotations(),
    };
    console.log(JSON.stringify(payload, null, 2));
  }

  zoomIn(): void {
    this.zoom.update((z) =>
      Math.min(this.maxZoom, this.roundZoom(z + this.zoomStep)),
    );
  }

  zoomOut(): void {
    this.zoom.update((z) =>
      Math.max(this.minZoom, this.roundZoom(z - this.zoomStep)),
    );
  }

  private roundZoom(z: number): number {
    return Math.round(z * 100) / 100;
  }

  private clamp01(n: number): number {
    return Math.min(1, Math.max(0, n));
  }

  onFirstPageLoaded(event: Event): void {
    if (this.initialZoomApplied) {
      return;
    }

    const img = event.target;

    if (!(img instanceof HTMLImageElement)) {
      return;
    }

    const viewport = img.closest('.viewport');

    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    if (!vw || !vh || !nw || !nh) {
      return;
    }

    const margin = 0.92;
    const zByHeight = (margin * vh * nw) / (nh * vw);
    const zByWidth = margin;
    const zFit = Math.min(1, zByHeight, zByWidth);
    this.zoom.set(
      this.roundZoom(Math.max(this.minZoom, Math.min(this.maxZoom, zFit))),
    );
    this.initialZoomApplied = true;
  }
}
