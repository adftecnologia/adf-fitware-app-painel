export const createDateTimeISO = () => {
  return new Date().toISOString();
};
export const createDateTimeNowPtBr = (replaceComma?: boolean): string => {
  const now = new Date();
  return now
    .toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(',', replaceComma ? ' às' : '');
};

export const createDateTimeFirebase = <T>(data: T): T => {
  const datetime = createDateTimeISO();
  return {
    ...data,
    createdAt: datetime,
    updatedAt: datetime,
  };
};

export const createDateTimeSort = (date?: string): number => {
  return new Date(date || '').getTime();
};

export const convertDatetimeToDate = (date?: string): string => {
  return new Date(date || '').toLocaleString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const updateDateTimeFirebase = <T>(data: T): T => {
  return {
    ...data,
    updatedAt: createDateTimeISO(),
  };
};

export const gerarNumeroSequencialData = (): number => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const decimoMs = Math.floor(now.getMilliseconds() / 100);
  return Number(`${yyyy}${mm}${dd}${hh}${min}${ss}${decimoMs}`);
};
