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
