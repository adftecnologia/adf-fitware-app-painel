import { TestBed } from '@angular/core/testing';

import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show loading', () => {
    service.show('Test message');

    service.loading$.subscribe(loading => {
      expect(loading).toBe(true);
    });

    service.message$.subscribe(message => {
      expect(message).toBe('Test message');
    });
  });

  it('should hide loading', () => {
    service.hide();

    service.loading$.subscribe(loading => {
      expect(loading).toBe(false);
    });
  });
});
