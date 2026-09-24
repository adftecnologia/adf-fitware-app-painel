import { TestBed } from '@angular/core/testing';
import { APICatraService } from './api-catra.service';

describe('APICatraService', () => {
  let service: APICatraService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(APICatraService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
