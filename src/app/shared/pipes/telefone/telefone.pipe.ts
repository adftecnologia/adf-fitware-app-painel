import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'telefone',
  standalone: true,
})
export class TelefonePipe implements PipeTransform {
  public transform(value: string | null | undefined): string {
    if (!value) return '';

    // Remove todos os caracteres não numéricos
    const numero = value.replace(/\D/g, '');
    const length = numero.length;

    // Verifica o tamanho e aplica a máscara correspondente
    if (length === 10) {
      // Telefone fixo: (11) 1234-5678
      return numero.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (length === 11) {
      // Celular: (11) 91234-5678
      return numero.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (length === 8) {
      // Telefone sem DDD: 1234-5678
      return numero.replace(/(\d{4})(\d{4})/, '$1-$2');
    } else if (length === 9) {
      // Celular sem DDD: 91234-5678
      return numero.replace(/(\d{5})(\d{4})/, '$1-$2');
    }

    // Se não se encaixa em nenhum padrão, retorna como está
    return value;
  }
}
