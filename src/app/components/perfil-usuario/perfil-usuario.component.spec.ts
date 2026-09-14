import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PerfilUsuarioComponent } from './perfil-usuario.component';
import { AuthService } from '../../shared/services/auth-service/auth.service';

describe('PerfilUsuarioComponent', () => {
  let component: PerfilUsuarioComponent;
  let fixture: ComponentFixture<PerfilUsuarioComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      getCurrentUserObservable: of({ email: 'test@example.com' }),
    });

    await TestBed.configureTestingModule({
      imports: [PerfilUsuarioComponent],
      providers: [{ provide: AuthService, useValue: authServiceSpy }],
    }).compileComponents();

    mockAuthService = TestBed.inject(
      AuthService
    ) as jasmine.SpyObj<AuthService>;

    fixture = TestBed.createComponent(PerfilUsuarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty values', () => {
    expect(component.nome).toBe('');
    expect(component.email).toBe('test@example.com'); // Email é carregado do AuthService
  });
});
