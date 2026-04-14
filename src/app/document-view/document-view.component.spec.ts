import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { DocumentViewComponent } from './document-view.component';
import { DocumentViewInteractionService } from '../services/document-view-interaction.service';

describe('DocumentViewComponent', () => {
  let fixture: ComponentFixture<DocumentViewComponent>;
  let httpMock: HttpTestingController;

  function createWithRoute(paramId: string | undefined): void {
    TestBed.resetTestingModule();

    const paramMap =
      paramId === undefined
        ? convertToParamMap({})
        : convertToParamMap({ id: paramId });

    TestBed.configureTestingModule({
      imports: [DocumentViewComponent, HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap } },
        },
      ],
    });

    fixture = TestBed.createComponent(DocumentViewComponent);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock?.verify();
  });

  it('при отсутствии id показывает ошибку без HTTP', () => {
    createWithRoute(undefined);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Не указан id документа');
  });

  it('после успешной загрузки показывает имя документа', () => {
    createWithRoute('1');
    fixture.detectChanges();
    const req = httpMock.expectOne('assets/mocks/1.json');
    req.flush({
      name: 'Мой документ',
      pages: [{ number: 1, imageUrl: 'pages/1.png' }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Мой документ');
  });

  it('при ошибке HTTP показывает сообщение', () => {
    createWithRoute('1');
    fixture.detectChanges();
    const req = httpMock.expectOne('assets/mocks/1.json');
    req.flush('err', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Не удалось загрузить документ',
    );
  });

  it('ngOnDestroy вызывает dispose у сервиса взаимодействия', () => {
    createWithRoute('1');
    fixture.detectChanges();
    httpMock.expectOne('assets/mocks/1.json').flush({
      name: 'D',
      pages: [{ number: 1, imageUrl: 'p.png' }],
    });
    fixture.detectChanges();

    const interaction = fixture.debugElement.injector.get(
      DocumentViewInteractionService,
    );
    spyOn(interaction, 'dispose');
    fixture.destroy();
    expect(interaction.dispose).toHaveBeenCalled();
  });

  it('onDocumentKeydown делегирует в сервис', () => {
    createWithRoute('1');
    fixture.detectChanges();
    httpMock.expectOne('assets/mocks/1.json').flush({
      name: 'D',
      pages: [{ number: 1, imageUrl: 'p.png' }],
    });
    fixture.detectChanges();

    const interaction = fixture.debugElement.injector.get(
      DocumentViewInteractionService,
    );
    spyOn(interaction, 'onDocumentKeydown');
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    fixture.componentInstance.onDocumentKeydown(ev);
    expect(interaction.onDocumentKeydown).toHaveBeenCalledWith(ev);
  });
});
