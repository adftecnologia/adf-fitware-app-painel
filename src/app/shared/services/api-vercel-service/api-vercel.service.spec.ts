import { TestBed } from '@angular/core/testing';

import { ApiVercelService } from './api-vercel.service';

describe('ApiVercelService', () => {
  let service: ApiVercelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ApiVercelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
