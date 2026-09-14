import { Directive, ElementRef, HostListener, OnInit } from '@angular/core';
import { TECLAS_PERMITIDAS } from '../../constants/helper.const';

@Directive({
  selector: '[appTelefoneMask]',
  standalone: true,
})
export class TelefoneMaskDirective implements OnInit {
  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  public ngOnInit() {
    this.el.nativeElement.setAttribute('placeholder', '(11) 99999-9999');
  }

  @HostListener('input', ['$event'])
  public onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não é dígito

    // Limita a 11 dígitos
    if (value.length > 11) {
      value = value.substring(0, 11);
    }

    // Aplica a máscara baseada no tamanho
    let formattedValue = '';

    const length = value.length;

    if (length >= 2) {
      formattedValue = `(${value.substring(0, 2)}`;

      if (length >= 3) {
        formattedValue += `) ${value.substring(2, length <= 10 ? 6 : 7)}`;

        if (length >= (length <= 10 ? 7 : 8)) {
          const finalPart = value.substring(length <= 10 ? 6 : 7);
          formattedValue += `-${finalPart}`;
        }
      }
    } else {
      formattedValue = value;
    }

    // Só atualiza se o valor mudou para evitar loop
    if (input.value !== formattedValue) {
      // Salva a posição do cursor
      const cursorPosition = input.selectionStart || 0;

      // Atualiza o valor
      input.value = formattedValue;

      // Restaura a posição do cursor (ajustando para o novo tamanho)
      const originalLength = input.value.replace(/\D/g, '').length;
      const newCursorPosition = Math.min(
        cursorPosition + (formattedValue.length - originalLength),
        formattedValue.length
      );
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  }

  @HostListener('keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    // Permite: backspace, delete, tab, escape, enter, setas
    if (TECLAS_PERMITIDAS.includes(event.key)) {
      return;
    }

    // Permite: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if (
      (event.ctrlKey || event.metaKey) &&
      ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())
    ) {
      return;
    }

    // Bloqueia tudo que não seja número
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  }
}
