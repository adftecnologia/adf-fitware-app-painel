import { IFirebaseConfigCliente } from './firebase-config.model';
import { IUsuario } from './sistema.model';

export interface IHttpResponse<T = any> {
  success: boolean;
  message: string;
  error?: string;
  data: T;
}

export interface IUsuarioResponse {
  users: IUsuario[];
  total: number;
}

export interface IUsuarioCreateResponse {
  user: IUsuario;
}

export interface ITenantResumo {
  tenant: string;
  projectId: string;
  clientEmail: string;
  databaseURL: string;
  updatedAt?: string;
}

export interface ITenantsResponse {
  tenants: ITenantResumo[];
  total: number;
}

export interface ITenantResponse {
  tenant: ITenantResumo;
}

export interface ITenantTesteResponse {
  tenant: string;
  projectId?: string;
  temUsuarios?: boolean;
}

export interface IEnvironmentResumo {
  tenant: string;
  config: IFirebaseConfigCliente;
  updatedAt?: string;
  /**
   * Falso quando a config está no nó de desabilitados — o app do cliente não
   * consegue inicializar o Firebase enquanto estiver assim.
   */
  habilitado: boolean;
  desabilitadoEm?: string;
  desabilitadoPor?: string;
}

export interface IEnvironmentsResponse {
  environments: IEnvironmentResumo[];
  total: number;
}

export interface IEnvironmentResponse {
  environment: IEnvironmentResumo;
}

export interface IGatewayStatusResponse {
  total: number;
  configurados: number;
}

/// CRIAÇÃO AUTOMATIZADA DE PROJETOS ///

export enum EStatusConexaoGoogle {
  ATIVA = 'ATIVA',
  EXPIRADA = 'EXPIRADA',
}

export interface IGoogleOAuthStatusResponse {
  conectado: boolean;
  email?: string;
  conectadoEm?: string;
  statusConexao?: EStatusConexaoGoogle;
  ultimaRenovacao?: string;
  ultimoErro?: string;
}

export interface IGoogleOAuthUrlResponse {
  url: string;
}

/**
 * Espelho de EEtapaProvisionamento em lib/helper/provisionamento.helper.ts.
 * A ordem de execução vem do backend (campo `etapas` da listagem), para não
 * existirem duas fontes da verdade sobre a sequência.
 */
export enum EEtapaProvisionamento {
  CRIAR_PROJETO = 'CRIAR_PROJETO',
  HABILITAR_APIS = 'HABILITAR_APIS',
  ADICIONAR_FIREBASE = 'ADICIONAR_FIREBASE',
  CRIAR_RTDB = 'CRIAR_RTDB',
  HABILITAR_AUTH = 'HABILITAR_AUTH',
  CRIAR_APP_WEB = 'CRIAR_APP_WEB',
  CRIAR_SERVICE_ACCOUNT = 'CRIAR_SERVICE_ACCOUNT',
  SEMEAR_DADOS = 'SEMEAR_DADOS',
  CONCLUIDO = 'CONCLUIDO',
}

export enum EStatusProvisionamento {
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  ERRO = 'ERRO',
  /** Parado à espera de algo que só pode ser feito no console do Google. */
  AGUARDANDO_MANUAL = 'AGUARDANDO_MANUAL',
  CONCLUIDO = 'CONCLUIDO',
}

export enum EStatusEvento {
  SUCESSO = 'SUCESSO',
  ERRO = 'ERRO',
  MANUAL = 'MANUAL',
}

export interface IAcaoManual {
  etapa: EEtapaProvisionamento;
  titulo: string;
  motivo: string;
  url: string;
  instrucoes: string[];
}

export interface IEventoProvisionamento {
  etapa: EEtapaProvisionamento;
  status: EStatusEvento;
  dataHora: string;
  duracaoMs: number;
  resumo: string;
  erro?: string;
}

export interface IProvisionamentoResumo {
  tenant: string;
  projectId: string;
  displayName: string;
  locationId: string;
  nomeEmpresa: string;
  admin: { nome: string; email: string };
  status: EStatusProvisionamento;
  etapaAtual: EEtapaProvisionamento;
  etapasConcluidas: EEtapaProvisionamento[];
  dados: {
    projectNumber?: string;
    databaseURL?: string;
    appId?: string;
    clientEmail?: string;
  };
  historico: IEventoProvisionamento[];
  erro?: string;
  acaoManual?: IAcaoManual;
  /** Quantas vezes a etapa atual bateu em propagação e será refeita. */
  tentativasEtapaAtual?: number;
  /** Quando true, vale esperar mais antes de chamar a próxima etapa. */
  aguardandoPropagacao?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface IEtapaDescrita {
  etapa: EEtapaProvisionamento;
  rotulo: string;
}

export interface IProvisionamentosResponse {
  provisionamentos: IProvisionamentoResumo[];
  total: number;
  etapas: IEtapaDescrita[];
  locaisRtdb: string[];
}

export interface IProvisionamentoResponse {
  provisionamento: IProvisionamentoResumo;
}
