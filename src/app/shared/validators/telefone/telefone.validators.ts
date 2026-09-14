import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DDDS_VALIDOS } from '../../constants/helper.const';

export class TelefoneValidators {
  /**
   * Validator para telefone brasileiro
   * Verifica se o telefone tem o formato e tamanho corretos
   */
  public static telefoneValido(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null; // Se não há valor, deixa para o required validar
      }

      const telefone = control.value.toString();

      // Remove todos os caracteres não numéricos para validação
      const apenasNumeros = telefone.replace(/\D/g, '');

      // Verifica se tem pelo menos 10 dígitos (telefone fixo com DDD)
      // ou 11 dígitos (celular com DDD)
      if (apenasNumeros.length < 10) {
        return {
          telefoneInvalido: {
            message: 'Telefone deve ter pelo menos 10 dígitos',
            valorAtual: telefone,
            tamanhoAtual: apenasNumeros.length,
            tamanhoMinimo: 10,
          },
        };
      }

      // Verifica se não excede 11 dígitos
      if (apenasNumeros.length > 11) {
        return {
          telefoneInvalido: {
            message: 'Telefone deve ter no máximo 11 dígitos',
            valorAtual: telefone,
            tamanhoAtual: apenasNumeros.length,
            tamanhoMaximo: 11,
          },
        };
      }

      // Verifica formato específico para celular (11 dígitos)
      if (apenasNumeros.length === 11) {
        // Para celular, o terceiro dígito deve ser 9
        if (apenasNumeros[2] !== '9') {
          return {
            telefoneInvalido: {
              message: 'Para celular, o terceiro dígito deve ser 9',
              valorAtual: telefone,
            },
          };
        }
      }

      // Verifica se o DDD é válido (códigos de área do Brasil)
      const ddd = apenasNumeros.substring(0, 2);

      if (!DDDS_VALIDOS.includes(ddd)) {
        return {
          telefoneInvalido: {
            message: 'DDD inválido',
            valorAtual: telefone,
            ddd: ddd,
          },
        };
      }

      return null; // Telefone válido
    };
  }

  /**
   * Validator mais simples que apenas verifica tamanho mínimo
   * Use este se quiser apenas a validação de tamanho
   */
  public static tamanhoMinimo(tamanhoMinimo: number = 15): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const telefone = control.value.toString();

      if (telefone.length < tamanhoMinimo) {
        return {
          tamanhoMinimo: {
            message: `Telefone deve ter pelo menos ${tamanhoMinimo} caracteres`,
            tamanhoAtual: telefone.length,
            tamanhoMinimo: tamanhoMinimo,
          },
        };
      }

      return null;
    };
  }
}
