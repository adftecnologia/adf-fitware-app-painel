import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CpfCnpjValidators {
  public static cpfCnpjValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const digits = (control.value ?? '').replace(/\D/g, '');
      if (!digits) return null;
      if (digits.length !== 11 && digits.length !== 14) {
        return { cpfCnpjLength: true };
      }
      return null;
    };
  }

  public static cpfValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const digits = (control.value ?? '').replace(/\D/g, '');
      if (!digits) return null;
      if (digits.length !== 11) {
        return { cpfLength: true };
      }
      return null;
    };
  }
}
