import { Directive, ElementRef, HostListener, OnInit } from '@angular/core';

@Directive({
  selector: '[appCepMask]',
  standalone: true,
})
export class CepMaskDirective implements OnInit {
  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  public ngOnInit() {
    this.el.nativeElement.setAttribute('placeholder', '00000-000');
  }

  @HostListener('input', ['$event'])
  public onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 8) {
      value = value.substring(0, 8);
    }

    if (value.length > 5) {
      value = `${value.substring(0, 5)}-${value.substring(5)}`;
    }

    if (input.value !== value) {
      const cursorPosition = input.selectionStart || 0;
      input.value = value;
      const newCursorPosition = Math.min(value.length, cursorPosition + 1);
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  }

  @HostListener('keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
    if (allowedKeys.includes(event.key)) {
      return;
    }

    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  }
}
