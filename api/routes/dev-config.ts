import type { VercelResponse } from '@vercel/node';
import {
  assertValidFirebaseConfigCliente,
  deleteEnvironmentConfig,
  IFirebaseConfigCliente,
  listEnvironmentConfigs,
  saveEnvironmentConfig,
  updateEnvironmentConfig,
} from '../../lib/helper/environment-config.helper';
import { getGatewayStatusSummary } from '../../lib/helper/gateway-status.helper';
import {
  EHttpMethod,
  EHttpStatusCode,
  HttpHelper,
} from '../../lib/helper/sistema.helper';
import {
  assertValidTenantName,
  deleteTenantServiceAccount,
  getTenantContext,
  ITenantAuthenticatedRequest,
  listTenantServiceAccounts,
  saveTenantServiceAccount,
  TenantHelper,
  updateTenantDatabaseUrl,
} from '../../lib/helper/tenant.helper';
import { withErrorHandling } from '../../lib/middlewares/sistema.midd';

/**
 * Configuração de tenants e environments — painel interno, uso exclusivo da
 * equipe fitware.
 *
 * Todas as ações vivem nesta única Serverless Function porque o plano free da
 * Vercel limita o projeto a 12 funções, e cada arquivo dentro de api/ consome
 * uma. Rota dinâmica não é opção: o rewrite de /api/routes/(.*) no
 * vercel.json reescreve para um caminho literal e não resolve rotas
 * dinâmicas.
 *
 * O recurso vai no header X-Dev-Resource e a operação continua sendo o método
 * HTTP, mantendo a semântica sem depender do caminho:
 *
 *   GET    X-Dev-Resource: tenants             lista tenants provisionados
 *   POST   X-Dev-Resource: tenants             provisiona ou troca a credencial
 *   PATCH  X-Dev-Resource: tenants             atualiza a URL do banco
 *   DELETE X-Dev-Resource: tenants             remove o tenant
 *   POST   X-Dev-Resource: tenant-connection   valida a credencial de um tenant
 *   GET    X-Dev-Resource: environments        lista configs Firebase client-side
 *   POST   X-Dev-Resource: environments        provisiona uma config
 *   PATCH  X-Dev-Resource: environments        atualiza uma config existente
 *   DELETE X-Dev-Resource: environments        remove uma config
 *   GET    X-Dev-Resource: gateway-status      apura tenants c/ Mercado Pago ativo
 */

export enum EDevResource {
  TENANTS = 'tenants',
  TENANT_CONNECTION = 'tenant-connection',
  ENVIRONMENTS = 'environments',
  GATEWAY_STATUS = 'gateway-status',
}

/** Header que identifica o recurso alvo da requisição. */
export const DEV_RESOURCE_HEADER = 'x-dev-resource';

interface IServiceAccountJson {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

const badRequestError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.BAD_REQUEST;
  return error;
};

const notFoundError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.NOT_FOUND;
  return error;
};

/**
 * Aceita o conteúdo do arquivo baixado do Firebase tanto como objeto quanto
 * como o texto colado no painel.
 */
function parseServiceAccount(input: unknown): IServiceAccountJson {
  if (!input) {
    throw badRequestError('Informe o JSON da conta de serviço.');
  }

  if (typeof input === 'object') {
    return input as IServiceAccountJson;
  }

  if (typeof input !== 'string') {
    throw badRequestError('Formato de conta de serviço não reconhecido.');
  }

  try {
    return JSON.parse(input) as IServiceAccountJson;
  } catch {
    throw badRequestError(
      'O conteúdo informado não é um JSON válido. Cole o arquivo baixado do Firebase sem alterações.'
    );
  }
}

async function handleListTenants(res: VercelResponse): Promise<void> {
  const tenants = await listTenantServiceAccounts();

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: 'Tenants provisionados',
    data: { tenants, total: tenants.length },
  });
}

async function handleSaveTenant(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const { tenant, serviceAccount, databaseURL } = req.body ?? {};

  if (!tenant || typeof tenant !== 'string') {
    throw badRequestError('Informe o identificador do tenant.');
  }

  const normalizedTenant = tenant.trim().toLowerCase();
  assertValidTenantName(normalizedTenant);

  const {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  } = parseServiceAccount(serviceAccount);

  if (!projectId || !clientEmail || !privateKey) {
    throw badRequestError(
      'JSON incompleto: são necessários os campos project_id, client_email e private_key. Baixe o arquivo em Firebase Console > Configurações do projeto > Contas de serviço.'
    );
  }

  const resolvedDatabaseURL =
    typeof databaseURL === 'string' && databaseURL.trim()
      ? databaseURL.trim()
      : `https://${projectId}-default-rtdb.firebaseio.com`;

  const summary = await saveTenantServiceAccount({
    tenant: normalizedTenant,
    projectId,
    clientEmail,
    privateKey,
    databaseURL: resolvedDatabaseURL,
  });

  console.info(
    `[dev-config] Credencial do tenant "${normalizedTenant}" atualizada por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Tenant "${normalizedTenant}" provisionado com sucesso`,
    data: { tenant: summary },
  });
}

/** Lê e valida o nome do tenant enviado no corpo da requisição. */
function lerTenantDoCorpo(req: ITenantAuthenticatedRequest): string {
  const { tenant } = req.body ?? {};

  if (!tenant || typeof tenant !== 'string') {
    throw badRequestError('Informe o identificador do tenant.');
  }

  const normalizado = tenant.trim().toLowerCase();
  assertValidTenantName(normalizado);

  return normalizado;
}

/**
 * Atualiza a URL do banco sem exigir o reenvio da chave privada.
 * Para trocar a credencial em si, use POST com o JSON completo.
 */
async function handleUpdateTenant(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const tenant = lerTenantDoCorpo(req);
  const { databaseURL } = req.body ?? {};

  if (typeof databaseURL !== 'string' || !databaseURL.trim()) {
    throw badRequestError('Informe a URL do Realtime Database.');
  }

  const summary = await updateTenantDatabaseUrl(tenant, databaseURL.trim());

  console.info(
    `[dev-config] Tenant "${tenant}" atualizado por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Tenant "${tenant}" atualizado com sucesso`,
    data: { tenant: summary },
  });
}

async function handleDeleteTenant(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const tenant = lerTenantDoCorpo(req);

  const summary = await deleteTenantServiceAccount(tenant);

  console.info(
    `[dev-config] Tenant "${tenant}" removido por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Tenant "${tenant}" removido. A gestão de usuários dele deixa de funcionar.`,
    data: { tenant: summary },
  });
}

/**
 * Verifica se a credencial gravada realmente funciona, exercitando o Auth do
 * tenant. Confirma de uma vez a decifragem, a chave e as permissões da conta
 * de serviço.
 */
async function handleTestTenant(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const { tenant } = req.body ?? {};

  if (!tenant || typeof tenant !== 'string') {
    throw badRequestError('Informe o tenant a ser testado.');
  }

  const normalizedTenant = tenant.trim().toLowerCase();
  assertValidTenantName(normalizedTenant);

  try {
    const context = await getTenantContext(normalizedTenant);
    const { users } = await context.auth.listUsers(1);

    res.status(EHttpStatusCode.OK).json({
      success: true,
      message: 'Conexão estabelecida com sucesso',
      data: {
        tenant: normalizedTenant,
        projectId: context.projectId,
        temUsuarios: users.length > 0,
      },
    });
  } catch (error: any) {
    res.status(EHttpStatusCode.OK).json({
      success: false,
      message: 'Falha ao conectar com o projeto do tenant',
      error: error.message,
      data: { tenant: normalizedTenant },
    });
  }
}

/** Lê e valida o nome do tenant e a configuração enviados no corpo. */
function lerTenantEConfigDoCorpo(req: ITenantAuthenticatedRequest): {
  tenant: string;
  config: IFirebaseConfigCliente;
} {
  const { tenant, config } = req.body ?? {};

  if (!tenant || typeof tenant !== 'string') {
    throw badRequestError('Informe o identificador do tenant.');
  }

  const normalizado = tenant.trim().toLowerCase();
  assertValidTenantName(normalizado);

  try {
    assertValidFirebaseConfigCliente(config);
  } catch (error: any) {
    throw badRequestError(error.message);
  }

  return { tenant: normalizado, config };
}

async function handleListEnvironments(res: VercelResponse): Promise<void> {
  const environments = await listEnvironmentConfigs();

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: 'Environments provisionados',
    data: { environments, total: environments.length },
  });
}

async function handleSaveEnvironment(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const { tenant, config } = lerTenantEConfigDoCorpo(req);

  const environment = await saveEnvironmentConfig(tenant, config);

  console.info(
    `[dev-config] Environment do tenant "${tenant}" gravado por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Environment do tenant "${tenant}" salvo com sucesso`,
    data: { environment },
  });
}

async function handleUpdateEnvironment(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const { tenant, config } = lerTenantEConfigDoCorpo(req);

  const environment = await updateEnvironmentConfig(tenant, config);

  console.info(
    `[dev-config] Environment do tenant "${tenant}" atualizado por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Environment do tenant "${tenant}" atualizado com sucesso`,
    data: { environment },
  });
}

async function handleDeleteEnvironment(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const tenant = lerTenantDoCorpo(req);

  const environment = await deleteEnvironmentConfig(tenant);

  console.info(
    `[dev-config] Environment do tenant "${tenant}" removido por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Environment do tenant "${tenant}" removido`,
    data: { environment },
  });
}

async function handleGatewayStatus(res: VercelResponse): Promise<void> {
  const summary = await getGatewayStatusSummary();

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: 'Status de gateway apurado',
    data: summary,
  });
}

async function devConfigHandler(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  TenantHelper.validateConfigProjectEnvs();
  await HttpHelper.checkAuthentication(req);

  const cabecalho = req.headers[DEV_RESOURCE_HEADER];
  const recurso = (Array.isArray(cabecalho) ? cabecalho[0] : cabecalho)
    ?.trim()
    .toLowerCase();

  // Todas as ações compartilham a mesma URL, então o log é o que permite
  // distinguir uma chamada da outra nos registros da Vercel.
  console.info(
    `[dev-config] ${req.method} ${recurso ?? '(sem recurso)'} por ${req.user?.email}`
  );

  if (recurso === EDevResource.TENANTS) {
    if (req.method === EHttpMethod.GET) {
      return await handleListTenants(res);
    }

    if (req.method === EHttpMethod.POST) {
      return await handleSaveTenant(req, res);
    }

    if (req.method === EHttpMethod.PATCH) {
      return await handleUpdateTenant(req, res);
    }

    if (req.method === EHttpMethod.DELETE) {
      return await handleDeleteTenant(req, res);
    }
  }

  if (
    recurso === EDevResource.TENANT_CONNECTION &&
    req.method === EHttpMethod.POST
  ) {
    return await handleTestTenant(req, res);
  }

  if (recurso === EDevResource.ENVIRONMENTS) {
    if (req.method === EHttpMethod.GET) {
      return await handleListEnvironments(res);
    }

    if (req.method === EHttpMethod.POST) {
      return await handleSaveEnvironment(req, res);
    }

    if (req.method === EHttpMethod.PATCH) {
      return await handleUpdateEnvironment(req, res);
    }

    if (req.method === EHttpMethod.DELETE) {
      return await handleDeleteEnvironment(req, res);
    }
  }

  if (
    recurso === EDevResource.GATEWAY_STATUS &&
    req.method === EHttpMethod.GET
  ) {
    return await handleGatewayStatus(res);
  }

  // Os erros sobem para withErrorHandling, que preserva o status definido em
  // cada um (400, 404) em vez de achatar tudo em 500.
  throw notFoundError(
    `Recurso não encontrado: ${req.method} ${DEV_RESOURCE_HEADER}=${recurso ?? '(vazio)'}`
  );
}

export default withErrorHandling(devConfigHandler);
