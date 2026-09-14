import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingComponent } from './loading.component';

describe('LoadingComponent', () => {
  let component: LoadingComponent;
  let fixture: ComponentFixture<LoadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display default message', () => {
    expect(component.message).toBe('Verificando autenticação...');
  });

  it('should show progress bar by default', () => {
    expect(component.showProgress).toBe(true);
  });

  it('should show brand by default', () => {
    expect(component.showBrand).toBe(true);
  });

  it('should accept custom message', () => {
    component.message = 'Carregando dados...';
    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.loading-text').textContent).toContain(
      'Carregando dados...'
    );
  });
});
