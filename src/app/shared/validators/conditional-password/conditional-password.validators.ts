import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class ConditionalPasswordValidators {
  /**
   * Validator para senhas condicionais durante edição de usuário
   * - Se for criação (isEditing = false), ambas as senhas são obrigatórias
   * - Se for edição (isEditing = true), as senhas são opcionais
   * - Mas se uma senha for preenchida durante edição, ambas se tornam obrigatórias
   */
  static conditionalPasswordRequired(isEditing: boolean): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.get('password');
      const confirmPassword = control.get('confirmPassword');

      if (!password || !confirmPassword) {
        return null;
      }

      const passwordValue = password.value?.trim() || '';
      const confirmPasswordValue = confirmPassword.value?.trim() || '';

      // Se for criação, ambas são obrigatórias
      if (!isEditing) {
        const errors: ValidationErrors = {};

        if (!passwordValue) {
          errors['passwordRequired'] = { message: 'Senha é obrigatória' };
        }

        if (!confirmPasswordValue) {
          errors['confirmPasswordRequired'] = {
            message: 'Confirmação de senha é obrigatória',
          };
        }

        return Object.keys(errors).length > 0 ? errors : null;
      }

      // Se for edição e uma das senhas foi preenchida
      if (isEditing && (passwordValue || confirmPasswordValue)) {
        const errors: ValidationErrors = {};

        if (!passwordValue) {
          errors['passwordRequiredWhenEditing'] = {
            message: 'Se alterar a senha, a senha é obrigatória',
          };
        }

        if (!confirmPasswordValue) {
          errors['confirmPasswordRequiredWhenEditing'] = {
            message: 'Se alterar a senha, a confirmação é obrigatória',
          };
        }

        return Object.keys(errors).length > 0 ? errors : null;
      }

      return null;
    };
  }

  /**
   * Validator para verificar se as senhas são iguais
   * Só valida se ambas as senhas estiverem preenchidas
   */
  static passwordsMatch(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.get('password');
      const confirmPassword = control.get('confirmPassword');

      if (!password || !confirmPassword) {
        return null;
      }

      const passwordValue = password.value?.trim() || '';
      const confirmPasswordValue = confirmPassword.value?.trim() || '';

      // Só valida se ambas estiverem preenchidas
      if (
        passwordValue &&
        confirmPasswordValue &&
        passwordValue !== confirmPasswordValue
      ) {
        return { passwordsMismatch: { message: 'As senhas não coincidem' } };
      }

      return null;
    };
  }

  /**
   * Validator para tamanho mínimo de senha
   * Só valida se a senha estiver preenchida
   */
  static passwordMinLength(minLength: number = 6): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.get('password');

      if (!password) {
        return null;
      }

      const passwordValue = password.value?.trim() || '';

      // Só valida se a senha estiver preenchida
      if (passwordValue && passwordValue.length < minLength) {
        return {
          passwordMinLength: {
            message: `A senha deve ter pelo menos ${minLength} caracteres`,
            minLength,
            actualLength: passwordValue.length,
          },
        };
      }

      return null;
    };
  }
}
