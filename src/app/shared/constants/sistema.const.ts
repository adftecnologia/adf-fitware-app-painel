import { ETipoContrato } from '../enums/sistema.enum';

export const BADGE_TIPO_CONTRATO: { [key in ETipoContrato]: string } = {
  [ETipoContrato.COMISSIONADO]: 'badge-primary',
  [ETipoContrato.ESTAGIARIO]: 'badge-info',
  [ETipoContrato.TEMPORARIO]: 'badge-danger',
  [ETipoContrato.INSTITUTO]: 'badge-success',
  [ETipoContrato.EFETIVO]: 'badge-warning',
  [ETipoContrato.OUTROS]: 'badge-secondary',
};

export const CORES_PESSOAS: string[] = [
  'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
];
