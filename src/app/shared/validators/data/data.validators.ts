import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class DataValidators {
  /**
   * Valida se a data é válida
   */
  public static dataValida(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null; // Se não há valor, não valida (deixa para required se necessário)
      }

      const dataInput = new Date(control.value);

      // Verifica se é uma data válida
      if (isNaN(dataInput.getTime())) {
        return {
          dataInvalida: {
            message: 'Data inválida',
          },
        };
      }

      return null;
    };
  }

  /**
   * Valida se a data não é futura
   */
  public static naoFutura(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const dataInput = new Date(control.value);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Remove horas para comparar apenas a data

      if (dataInput > hoje) {
        return {
          dataFutura: {
            message: 'Data não pode ser futura',
          },
        };
      }

      return null;
    };
  }

  /**
   * Valida se a data é maior que uma data mínima
   */
  public static dataMinima(dataMinima: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const dataInput = new Date(control.value);
      const dataMin = new Date(dataMinima);

      if (dataInput < dataMin) {
        return {
          dataMenorQueMinima: {
            message: `Data deve ser maior ou igual a ${dataMin.toLocaleDateString('pt-BR')}`,
          },
        };
      }

      return null;
    };
  }

  /**
   * Valida (a nível de FormGroup) se a data de fim é igual ou posterior à data de início.
   * Usa os nomes de campo padrão do sistema: dataInicioContrato / dataFimContrato.
   */
  public static intervaloContratoValido(
    campoInicio: string = 'dataInicioContrato',
    campoFim: string = 'dataFimContrato'
  ): ValidatorFn {
    return (form: AbstractControl): ValidationErrors | null => {
      const inicio = form.get(campoInicio)?.value;
      const fim = form.get(campoFim)?.value;

      if (!inicio || !fim) {
        return null;
      }

      return new Date(inicio) <= new Date(fim) ? null : { dateRange: true };
    };
  }

  /**
   * Valida se a data está dentro de um intervalo
   */
  public static intervaloData(
    dataInicio: string,
    dataFim: string
  ): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const dataInput = new Date(control.value);
      const dataMin = new Date(dataInicio);
      const dataMax = new Date(dataFim);

      if (dataInput < dataMin || dataInput > dataMax) {
        return {
          dataForaIntervalo: {
            message: `Data deve estar entre ${dataMin.toLocaleDateString('pt-BR')} e ${dataMax.toLocaleDateString('pt-BR')}`,
          },
        };
      }

      return null;
    };
  }
}
