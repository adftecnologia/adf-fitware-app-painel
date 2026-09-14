import { EDistrito, ETipoContrato } from '../enums/sistema.enum';

export const getUsernameAcronym = (name: string): string => {
  return name
    .toUpperCase()
    .replace(' DE ', ' ')
    .replace(' DA ', ' ')
    .replace(' DO ', ' ')
    .replace(' DOS ', ' ')
    .replace(' DAS ', ' ')
    .split(' ')
    .map((name: string) => name.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export const getTwoLetterAcronym = (name: string): string => {
  return name
    .split(' ')
    .map((name: string) => name.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export const convertSalaryToPtBrCurrency = (salary: number) => {
  if (salary === null || salary === undefined) {
    return 'N/A';
  }
  return salary.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const formatWorkload = (workload: string) => {
  if (!workload) {
    return 'N/A';
  }
  if (!workload.includes('h')) {
    return `${workload}h`;
  }
  return workload;
};

export const getTipoContratoByValue = (value: ETipoContrato | string) => {
  return ETipoContrato[value as keyof typeof ETipoContrato];
};

export const getDistritoByValue = (value: EDistrito | string) => {
  return EDistrito[value as keyof typeof EDistrito];
};

/**
 * Normaliza texto removendo acentos e caracteres especiais para comparação
 * @param text - Texto a ser normalizado
 * @returns Texto normalizado sem acentos e em lowercase
 */
export const normalizarTexto = (text: string): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

/**
 * Remove propriedades com valores undefined de um objeto
 * Firebase não aceita valores undefined, apenas null
 * @param data - Objeto a ser limpo
 * @returns Objeto sem propriedades undefined
 */
export const removeUndefinedProperties = <T>(data: T): Partial<T> => {
  if (data === null || data === undefined) {
    return {} as Partial<T>;
  }
  return JSON.parse(JSON.stringify(data)) as Partial<T>;
};
