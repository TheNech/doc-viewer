import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentHeaderComponent } from './document-header.component';

describe('DocumentHeaderComponent', () => {
  let fixture: ComponentFixture<DocumentHeaderComponent>;
  let component: DocumentHeaderComponent;

  function setDefaultInputs(): void {
    fixture.componentRef.setInput('documentName', 'Тестовый документ');
    fixture.componentRef.setInput('zoom', 1);
    fixture.componentRef.setInput('minZoom', 0.25);
    fixture.componentRef.setInput('maxZoom', 3);
    fixture.componentRef.setInput('placementMode', false);
    fixture.componentRef.setInput('clearAllDisabled', false);
    fixture.componentRef.setInput('canUndo', false);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentHeaderComponent);
    component = fixture.componentInstance;
    setDefaultInputs();
    fixture.detectChanges();
  });

  it('создаётся и показывает имя документа', () => {
    expect(component).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.title')?.textContent?.trim(),
    ).toBe('Тестовый документ');
  });

  it('zoomOut вызывает выход', () => {
    spyOn(component.zoomOut, 'emit');
    const btn = fixture.nativeElement.querySelector(
      '[aria-label="Уменьшить масштаб"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(component.zoomOut.emit).toHaveBeenCalled();
  });

  it('zoomIn вызывает выход', () => {
    spyOn(component.zoomIn, 'emit');
    const btn = fixture.nativeElement.querySelector(
      '[aria-label="Увеличить масштаб"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(component.zoomIn.emit).toHaveBeenCalled();
  });

  it('togglePlacement вызывает выход', () => {
    spyOn(component.togglePlacement, 'emit');
    const buttons = fixture.nativeElement.querySelectorAll(
      '.annotation-toolbar .toolbar-btn-text',
    );
    (buttons[0] as HTMLButtonElement).click();
    expect(component.togglePlacement.emit).toHaveBeenCalled();
  });

  it('save вызывает выход', () => {
    spyOn(component.save, 'emit');
    const buttons = fixture.nativeElement.querySelectorAll(
      '.annotation-toolbar .toolbar-btn-text',
    );
    const saveBtn = Array.from(buttons as NodeListOf<HTMLButtonElement>).find(
      (b) => b.textContent?.trim() === 'Сохранить',
    );
    saveBtn?.click();
    expect(component.save.emit).toHaveBeenCalled();
  });
});
