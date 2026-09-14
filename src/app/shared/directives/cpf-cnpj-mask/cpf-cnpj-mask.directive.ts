import { Directive, ElementRef, HostListener } from '@angular/core';
import { TECLAS_PERMITIDAS } from '../../constants/helper.const';

@Directive({
  selector: '[appCpfCnpjMask]',
  standalone: true,
})
export class CpfCnpjMaskDirective {
  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  @HostListener('input', ['$event'])
  public onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '');

    if (digits.length > 14) {
      digits = digits.substring(0, 14);
    }

    const formatted = this.format(digits);

    if (input.value !== formatted) {
      const cursorPosition = input.selectionStart || 0;
      input.value = formatted;
      const newCursorPosition = Math.min(formatted.length, cursorPosition + 1);
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  }

  @HostListener('keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    if (TECLAS_PERMITIDAS.includes(event.key)) {
      return;
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())
    ) {
      return;
    }

    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  }

  private format(digits: string): string {
    const len = digits.length;

    if (len <= 11) {
      // CPF: 000.000.000-00
      let v = digits;
      if (len > 9) v = `${v.substring(0, 9)}-${v.substring(9)}`;
      if (len > 6) v = `${v.substring(0, 6)}.${v.substring(6)}`;
      if (len > 3) v = `${v.substring(0, 3)}.${v.substring(3)}`;
      return v;
    } else {
      // CNPJ: 00.000.000/0000-00
      let v = digits;
      if (len > 12) v = `${v.substring(0, 12)}-${v.substring(12)}`;
      if (len > 8) v = `${v.substring(0, 8)}/${v.substring(8)}`;
      if (len > 5) v = `${v.substring(0, 5)}.${v.substring(5)}`;
      if (len > 2) v = `${v.substring(0, 2)}.${v.substring(2)}`;
      return v;
    }
  }
}
