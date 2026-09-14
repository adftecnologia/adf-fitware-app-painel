import { EUsuarioPerfil, EUsuarioStatus } from '../enums/sistema.enum';

export const DDDS_VALIDOS: readonly string[] = [
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19', // SP
  '21',
  '22',
  '24', // RJ/ES
  '27',
  '28', // ES
  '31',
  '32',
  '33',
  '34',
  '35',
  '37',
  '38', // MG
  '41',
  '42',
  '43',
  '44',
  '45',
  '46', // PR
  '47',
  '48',
  '49', // SC
  '51',
  '53',
  '54',
  '55', // RS
  '61', // DF
  '62',
  '64', // GO
  '63', // TO
  '65',
  '66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71',
  '73',
  '74',
  '75',
  '77', // BA
  '79', // SE
  '81',
  '87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85',
  '88', // CE
  '86',
  '89', // PI
  '91',
  '93',
  '94', // PA
  '92',
  '97', // AM
  '95', // RR
  '96', // AP
  '98',
  '99', // MA
] as const;

export const TECLAS_PERMITIDAS: readonly string[] = [
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'Home',
  'End',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
] as const;

export const STATUS_COLORS: {
  [key in EUsuarioStatus]: string;
} = {
  [EUsuarioStatus.ATIVO]: 'badge bg-success text-white',
  [EUsuarioStatus.INATIVO]: 'badge bg-secondary text-white',
  [EUsuarioStatus.EXCLUIDO]: 'badge bg-danger text-white',
};

export const ROLE_COLORS: {
  [key in EUsuarioPerfil]: string;
} = {
  [EUsuarioPerfil.ADMIN]: 'badge bg-danger text-white',
  [EUsuarioPerfil.CADASTRADOR]: 'badge bg-primary text-white',
  [EUsuarioPerfil.VISUALIZADOR]: 'badge bg-info text-white',
};
