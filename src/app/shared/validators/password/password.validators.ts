import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class PasswordValidators {
  static passwordsIguais(
    controlName: string,
    matchingControlName: string
  ): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const control = formGroup.get(controlName);
      const matchingControl = formGroup.get(matchingControlName);

      if (!control || !matchingControl) {
        return null; // Controls not found, no validation needed
      }

      if (
        matchingControl.errors &&
        !matchingControl.errors['passwordMismatch']
      ) {
        return null; // Another error exists on matchingControl, don't override
      }

      if (control.value !== matchingControl.value) {
        matchingControl.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        matchingControl.setErrors(null); // Clear the error if they match
        return null;
      }
    };
  }
}
