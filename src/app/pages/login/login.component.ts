import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { BrandPanelComponent } from '../../components/brand-panel/brand-panel.component';
import { AuthService } from '../../shared/services/auth-service/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BrandPanelComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  errorMessage = '';
  anoAtual = new Date().getFullYear();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  public ngOnInit(): void {
    this.initForm();
  }

  public initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  public togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  public async onSubmit(): Promise<void> {
    if (!this.loginForm.valid) {
      // Marca todos os campos como touched para mostrar erros
      return Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;
    return this.authService
      .login(email, password)
      .then(() => {
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 200);
      })
      .catch(
        error =>
          (this.errorMessage =
            error.message || 'Erro ao fazer login. Tente novamente.')
      )
      .finally(() => (this.isLoading = false));
  }
}
