import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { DocumentApiService } from './document-api.service';

describe('DocumentApiService', () => {
  let service: DocumentApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(DocumentApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getDocument запрашивает JSON и нормализует относительные URL картинок', () => {
    let result: unknown;
    service.getDocument('1').subscribe((doc) => {
      result = doc;
    });

    const req = httpMock.expectOne('assets/mocks/1.json');
    expect(req.request.method).toBe('GET');
    req.flush({
      name: 'test',
      pages: [{ number: 1, imageUrl: 'pages/1.png' }],
    });

    expect(result).toEqual({
      name: 'test',
      pages: [{ number: 1, imageUrl: '/assets/pages/1.png' }],
    });
  });

  it('getDocument оставляет абсолютные http(s) URL без изменений', () => {
    let imageUrl = '';
    service.getDocument('x').subscribe((doc) => {
      imageUrl = doc.pages[0].imageUrl;
    });

    httpMock
      .expectOne('assets/mocks/x.json')
      .flush({
        name: 'x',
        pages: [{ number: 1, imageUrl: 'https://cdn.example.com/p.png' }],
      });

    expect(imageUrl).toBe('https://cdn.example.com/p.png');
  });
});
