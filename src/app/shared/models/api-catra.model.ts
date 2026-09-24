import { HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';

export interface IOptions<T> {
  body?: T;
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  observe?: 'body';
  params?:
    | HttpParams
    | Record<
        string,
        string | number | boolean | ReadonlyArray<string | number | boolean>
      >;
  responseType?: 'json';
  reportProgress?: boolean;
  withCredentials?: boolean;
  transferCache?:
    | {
        includeHeaders?: string[];
      }
    | boolean;
}

/**
 * Espelho de gatewayIntegration em src/helpers/constants.js do srv-catra.
 * Cada valor é o tenantId de um registro "Gateway Config" já existente lá -
 * ao cadastrar um novo provider/ambiente, adiciona-se a entrada aqui também.
 */
export enum EGatewayIntegration {
  FITWARE_MERCADO_PAGO_DEVELOP = 'fitware-gateway-mercado-pago-config-develop',
  // Produção não leva sufixo de stage - o registro foi criado antes dessa convenção.
  FITWARE_MERCADO_PAGO_PRODUCTION = 'fitware-gateway-mercado-pago-config',
}

/** Espelho de gatewayFeeType em src/helpers/constants.js do srv-catra. */
export enum EGatewayFeeType {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
}

export interface IGatewayMarketplaceFee {
  type: EGatewayFeeType;
  value: number;
}

export interface ITenantGateway {
  active: boolean;
  integration: EGatewayIntegration | string;
  acceptOauthCallback: boolean;
  marketplaceFee: IGatewayMarketplaceFee;
  redirectTenantUri: string;
  /** Campos abaixo só existem depois que o tenant concluir o fluxo OAuth. */
  userId?: number;
  expiresIn?: number;
  updateTokenDateAt?: string;
  isConnected?: boolean;
}

export interface ITenantGatewayConfig {
  tenantId: string;
  active: boolean;
  company: string;
  /** Só vem preenchida na resposta de criação - não é recuperável depois via GET. */
  apiKey?: string;
  gateway?: ITenantGateway;
  hasFirebaseConfig?: boolean;
  /**
   * Tenant do fitmanager-util vinculado a esta configuração. Não vem do srv-catra
   * (é específico do Fitware): o backend do painel anexa a partir do índice reverso.
   */
  firebaseTenant?: string | null;
}

interface IFirebaseAdminFields {
  /** projectId, clientEmail e privateKey são opcionais, mas sempre os 3 juntos ou nenhum. */
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface ICreateTenantGatewayConfigPayload
  extends IFirebaseAdminFields {
  tenantId: string;
  company: string;
  /** Se omitida, o srv-catra gera uma apiKey automaticamente. */
  apiKey?: string;
  gateway: {
    integration: EGatewayIntegration | string;
    marketplaceFee: IGatewayMarketplaceFee;
    redirectTenantUri: string;
  };
}

export interface IUpdateTenantGatewayConfigPayload
  extends IFirebaseAdminFields {
  active?: boolean;
  company?: string;
  gateway?: {
    active?: boolean;
    integration?: EGatewayIntegration | string;
    marketplaceFee?: IGatewayMarketplaceFee;
    redirectTenantUri?: string;
  };
}

export interface IListTenantsGatewayConfigResponse {
  items: ITenantGatewayConfig[];
  /** Token opaco de paginação - presente só quando há mais páginas. */
  nextToken?: string;
}
