import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class EmailValidators {
  public static emailValido(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const pattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      return pattern.test(control.value) ? null : { emailInvalido: true };
    };
  }
}
