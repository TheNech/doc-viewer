import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnnotationStyleControlsComponent } from './annotation-style-controls.component';

describe('AnnotationStyleControlsComponent', () => {
  let fixture: ComponentFixture<AnnotationStyleControlsComponent>;
  let component: AnnotationStyleControlsComponent;

  const baseStyle = {
    fontSizePx: 16,
    fontStyle: 'normal' as const,
    fontWeight: 'normal' as const,
    textDecoration: 'none' as const,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotationStyleControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationStyleControlsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('chromeStyle', baseStyle);
    fixture.componentRef.setInput('closeAriaLabel', 'Закрыть');
    fixture.componentRef.setInput('closeTitle', 'Закрыть панель');
    fixture.detectChanges();
  });

  it('создаётся', () => {
    expect(component).toBeTruthy();
  });

  it('toggleItalic вызывает выход', () => {
    spyOn(component.toggleItalic, 'emit');
    const btn = fixture.nativeElement.querySelector(
      '.chrome-btn[title="Курсив"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(component.toggleItalic.emit).toHaveBeenCalled();
  });

  it('onCloseClick останавливает всплытие и эмитит closeClick', () => {
    spyOn(component.closeClick, 'emit');
    const inner = fixture.nativeElement.querySelector(
      '.chrome-close',
    ) as HTMLButtonElement;
    const ev = new MouseEvent('click', { bubbles: true });
    spyOn(ev, 'stopPropagation');
    inner.dispatchEvent(ev);
    expect(ev.stopPropagation).toHaveBeenCalled();
    expect(component.closeClick.emit).toHaveBeenCalled();
  });

  it('input размера шрифта эмитит fontSizeInput', () => {
    spyOn(component.fontSizeInput, 'emit');
    const input = fixture.nativeElement.querySelector(
      '.font-size-input',
    ) as HTMLInputElement;
    input.value = '20';
    input.dispatchEvent(new Event('input'));
    expect(component.fontSizeInput.emit).toHaveBeenCalled();
  });
});
