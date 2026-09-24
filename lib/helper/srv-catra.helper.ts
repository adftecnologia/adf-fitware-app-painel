import { EHttpStatusCode } from './sistema.helper';

/**
 * Cliente server-to-server para o CRUD de configuração de gateway do srv-catra
 * (API multitenant em AWS Lambda, backend separado deste painel).
 *
 * As rotas gtw/config/tenant/* do srv-catra exigem autenticação em 3 camadas:
 * x-tenant-id/x-api-key do tenant ADMIN (aqui, sempre o tenant configurado nas
 * envs deste helper - nunca o tenant gerenciado, que vai em targetTenantId),
 * um token Firebase (Authorization: Bearer) do usuário que está operando o
 * painel, e a flag isAdmin nesse tenant admin. Por isso o tenant admin
 * cadastrado no srv-catra precisa ter isAdmin: true e o Firebase Admin SDK
 * (projectId/clientEmail/privateKey) configurados lá, apontando para o mesmo
 * projeto Firebase deste painel - só assim o token do usuário é aceito.
 *
 * Rodar isto sempre no servidor (nunca no browser) é o que permite reaproveitar
 * a credencial de tenant já provisionada (ver resolveFirebaseFields em
 * api/routes/dev-config.ts) sem que a privateKey trafegue até o navegador.
 */

export enum ESrvCatraEnv {
  SRV_CATRA_BASE_URL = 'SRV_CATRA_BASE_URL',
  SRV_CATRA_ADMIN_TENANT_ID = 'SRV_CATRA_ADMIN_TENANT_ID',
  SRV_CATRA_ADMIN_API_KEY = 'SRV_CATRA_ADMIN_API_KEY',
}

export interface IGatewayMarketplaceFee {
  type: 'fixed' | 'percentage';
  value: number;
}

export interface IGatewayConfig {
  active: boolean;
  integration: string;
  acceptOauthCallback: boolean;
  marketplaceFee: IGatewayMarketplaceFee;
  redirectTenantUri: string;
  /** Só existem depois que o tenant concluir o fluxo OAuth com o provider. */
  userId?: number;
  expiresIn?: number;
  updateTokenDateAt?: string;
  isConnected?: boolean;
}

export interface ITenantGatewayConfig {
  tenantId: string;
  active: boolean;
  company: string;
  /** Só vem preenchida na resposta de criação. */
  apiKey?: string;
  gateway?: IGatewayConfig;
  hasFirebaseConfig?: boolean;
}

export interface ICreateTenantGatewayConfigInput {
  tenantId: string;
  company: string;
  apiKey?: string;
  gateway: {
    integration: string;
    marketplaceFee: IGatewayMarketplaceFee;
    redirectTenantUri: string;
  };
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface IUpdateTenantGatewayConfigInput {
  active?: boolean;
  company?: string;
  gateway?: {
    active?: boolean;
    integration?: string;
    marketplaceFee?: IGatewayMarketplaceFee;
    redirectTenantUri?: string;
  };
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

/// FIM - MODELS ///

const getSrvCatraEnvVar = (key: ESrvCatraEnv): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Variável de ambiente ${key} não configurada`);
  }

  return value;
};

/** Valida que as variáveis do srv-catra estão presentes. */
export function validateSrvCatraEnvs(): void {
  const faltando = Object.values(ESrvCatraEnv).filter(
    envVar => !process.env[envVar]
  );

  if (faltando.length > 0) {
    throw new Error(
      `Variáveis de ambiente do srv-catra não definidas: ${faltando.join(', ')}`
    );
  }
}

const srvCatraError = (message: string, status: number): Error => {
  const error: any = new Error(message);
  error.status = status || EHttpStatusCode.INTERNAL_SERVER_ERROR;
  return error;
};

interface ISrvCatraResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

async function chamarSrvCatra<T>({
  method,
  path,
  firebaseIdToken,
  body,
}: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  firebaseIdToken: string;
  body?: unknown;
}): Promise<T> {
  const baseUrl = getSrvCatraEnvVar(ESrvCatraEnv.SRV_CATRA_BASE_URL);

  const resposta = await fetch(`${baseUrl}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': getSrvCatraEnvVar(ESrvCatraEnv.SRV_CATRA_ADMIN_TENANT_ID),
      'x-api-key': getSrvCatraEnvVar(ESrvCatraEnv.SRV_CATRA_ADMIN_API_KEY),
      Authorization: `Bearer ${firebaseIdToken}`,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const corpo = await resposta.text();

  let dados: ISrvCatraResponse<T>;

  try {
    dados = JSON.parse(corpo) as ISrvCatraResponse<T>;
  } catch {
    // Resposta não-JSON: normalmente a página de erro HTML do proxy ou do API
    // Gateway quando a rota/método não existe naquele ambiente. Sem tratar aqui,
    // o que chega ao painel é um "Unexpected token '<'" que não diz o que falhou.
    throw srvCatraError(
      `O srv-catra respondeu HTTP ${resposta.status} em "${method} ${path}" sem JSON válido. ` +
        'Confirme se essa rota já está publicada no ambiente apontado por SRV_CATRA_BASE_URL.',
      resposta.status
    );
  }

  if (!resposta.ok || dados.success === false) {
    throw srvCatraError(
      dados.message || `Falha ao chamar o srv-catra (HTTP ${resposta.status})`,
      resposta.status
    );
  }

  return dados.data;
}

export async function createTenantGatewayConfig(
  firebaseIdToken: string,
  payload: ICreateTenantGatewayConfigInput
): Promise<ITenantGatewayConfig> {
  return chamarSrvCatra<ITenantGatewayConfig>({
    method: 'POST',
    path: 'gtw/config/tenant',
    firebaseIdToken,
    body: payload,
  });
}

export async function updateTenantGatewayConfig(
  firebaseIdToken: string,
  targetTenantId: string,
  payload: IUpdateTenantGatewayConfigInput
): Promise<{ tenantId: string }> {
  return chamarSrvCatra<{ tenantId: string }>({
    method: 'PATCH',
    path: `gtw/config/tenant/${encodeURIComponent(targetTenantId)}`,
    firebaseIdToken,
    body: payload,
  });
}

export async function removeTenantGatewayConfig(
  firebaseIdToken: string,
  targetTenantId: string
): Promise<{ tenantId: string }> {
  return chamarSrvCatra<{ tenantId: string }>({
    method: 'DELETE',
    path: `gtw/config/tenant/${encodeURIComponent(targetTenantId)}/gateway`,
    firebaseIdToken,
  });
}

/**
 * Lê a configuração de um tenant. Com `includeApiKey`, a resposta traz também a
 * `apiKey` do srv-catra - necessária para replicar o vínculo no config store do
 * Fitware ao editar um tenant que já existe (na criação, a apiKey volta na própria
 * resposta do create). O valor nunca deve ser devolvido ao browser.
 */
export async function getTenantGatewayConfig(
  firebaseIdToken: string,
  targetTenantId: string,
  includeApiKey = false
): Promise<ITenantGatewayConfig> {
  const query = includeApiKey ? '?includeApiKey=true' : '';

  return chamarSrvCatra<ITenantGatewayConfig>({
    method: 'GET',
    path: `gtw/config/tenant/${encodeURIComponent(targetTenantId)}${query}`,
    firebaseIdToken,
  });
}

/**
 * Exclui DEFINITIVAMENTE o item inteiro do tenant no srv-catra (apiKey, gateway,
 * credencial Firebase, recaptcha - tudo). Diferente de removeTenantGatewayConfig,
 * que só remove o atributo `gateway`. O srv-catra recusa excluir o tenant admin
 * autenticado, tenants com isAdmin e registros de Gateway Config.
 */
export async function deleteTenantConfig(
  firebaseIdToken: string,
  targetTenantId: string
): Promise<{ tenantId: string }> {
  return chamarSrvCatra<{ tenantId: string }>({
    method: 'DELETE',
    path: `gtw/config/tenant/${encodeURIComponent(targetTenantId)}`,
    firebaseIdToken,
  });
}

/**
 * Limite de segurança para o loop de paginação abaixo - com o LIMIT_POR_PAGINA
 * abaixo, cobre até 800 tenants examinados sem risco de loop indevidamente
 * longo se algo no lado do srv-catra parar de devolver nextToken. Quando
 * `search` filtra a maioria dos itens de cada página (o Limit do Scan conta
 * itens EXAMINADOS, não itens que batem no filtro), menos tenants efetivos
 * cabem nesse teto - por isso o limite por página abaixo já vai no maior
 * valor aceito pela lambda.
 */
const MAX_PAGINAS_LISTAGEM = 20;

/** Teto de itens examinados por página aceito por listTenantsGatewayConfig.js no srv-catra. */
const LIMIT_POR_PAGINA = 40;

/**
 * Busca TODAS as páginas de tenants com gateway configurado e devolve uma
 * lista única já unida. O srv-catra faz Scan na tabela (sem GSI para listar só
 * por tipo), então o custo de leitura é o mesmo entre buscar tudo de uma vez
 * aqui ou reconsultar a cada filtro no frontend - unir tudo aqui permite o
 * filtro no Angular ser 100% local (sem refazer o Scan a cada tecla digitada),
 * seguindo o mesmo padrão de getTenants()/getEnvironments() deste painel.
 * @param search - Opcional. Restringe ao subconjunto de tenants cujo tenantId
 * contenha este valor - usado para não misturar tenants de outros produtos
 * que compartilhem a mesma tabela no srv-catra (ver handleListGatewayConfigs).
 */
export async function listAllTenantsGatewayConfig(
  firebaseIdToken: string,
  search?: string
): Promise<ITenantGatewayConfig[]> {
  const items: ITenantGatewayConfig[] = [];
  let nextToken: string | undefined;
  let paginas = 0;

  do {
    const query = new URLSearchParams();
    query.set('limit', String(LIMIT_POR_PAGINA));
    if (search) {
      query.set('search', search);
    }
    if (nextToken) {
      query.set('nextToken', nextToken);
    }

    const pagina = await chamarSrvCatra<{
      items: ITenantGatewayConfig[];
      nextToken?: string;
    }>({
      method: 'GET',
      path: `gtw/config/tenant?${query.toString()}`,
      firebaseIdToken,
    });

    items.push(...(pagina.items || []));
    nextToken = pagina.nextToken;
    paginas += 1;
  } while (nextToken && paginas < MAX_PAGINAS_LISTAGEM);

  return items;
}
