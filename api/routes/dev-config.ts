import type { VercelResponse } from '@vercel/node';
import {
  assertValidFirebaseConfigCliente,
  deleteEnvironmentConfig,
  desabilitarEnvironment,
  habilitarEnvironment,
  IFirebaseConfigCliente,
  listEnvironmentConfigs,
  saveEnvironmentConfig,
  updateEnvironmentConfig,
} from '../../lib/helper/environment-config.helper';
import { getGatewayStatusSummary } from '../../lib/helper/gateway-status.helper';
import { derivarProjectId } from '../../lib/helper/google-cloud.helper';
import {
  desconectar,
  gerarUrlAutorizacao,
  lerStatusConexao,
} from '../../lib/helper/google-oauth.helper';
import {
  descartarProvisionamento,
  executarProximaEtapa,
  iniciarProvisionamento,
  lerProvisionamento,
  listarProvisionamentos,
  LOCAIS_RTDB,
  ORDEM_ETAPAS,
  ROTULO_ETAPAS,
} from '../../lib/helper/provisionamento.helper';
import {
  EHttpMethod,
  EHttpStatusCode,
  HttpHelper,
} from '../../lib/helper/sistema.helper';
import {
  createTenantGatewayConfig,
  deleteTenantConfig,
  getTenantGatewayConfig,
  ICreateTenantGatewayConfigInput,
  IUpdateTenantGatewayConfigInput,
  listAllTenantsGatewayConfig,
  removeTenantGatewayConfig,
  updateTenantGatewayConfig,
  validateSrvCatraEnvs,
} from '../../lib/helper/srv-catra.helper';
import {
  assertValidTenantName,
  deleteTenantServiceAccount,
  getTenantContext,
  ITenantAuthenticatedRequest,
  listTenantServiceAccounts,
  loadTenantServiceAccount,
  saveTenantServiceAccount,
  TenantHelper,
  updateTenantDatabaseUrl,
} from '../../lib/helper/tenant.helper';
import {
  listarVinculos,
  vincularTenantGateway,
} from '../../lib/helper/tenant-gateway-link.helper';
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
 *   GET    X-Dev-Resource: google-oauth       status da conexão com o Google
 *   POST   X-Dev-Resource: google-oauth       gera a URL de consentimento
 *   DELETE X-Dev-Resource: google-oauth       desconecta a conta Google
 *   GET    X-Dev-Resource: project-provision  lista provisionamentos (ou um só)
 *   POST   X-Dev-Resource: project-provision  inicia a criação de um projeto
 *   PATCH  X-Dev-Resource: project-provision  executa a próxima etapa pendente
 *   DELETE X-Dev-Resource: project-provision  descarta um provisionamento
 *   POST   X-Dev-Resource: environment-status habilita/desabilita um tenant
 *   GET    X-Dev-Resource: gateway-config      lista config de gateway (srv-catra)
 *   POST   X-Dev-Resource: gateway-config      cria config de gateway de um tenant
 *   PATCH  X-Dev-Resource: gateway-config      atualiza config de gateway de um tenant
 *   DELETE X-Dev-Resource: gateway-config      remove a config de gateway de um tenant
 *   DELETE X-Dev-Resource: gateway-tenant      EXCLUI o tenant inteiro no srv-catra (irreversível)
 */

export enum EDevResource {
  TENANTS = 'tenants',
  TENANT_CONNECTION = 'tenant-connection',
  ENVIRONMENTS = 'environments',
  GATEWAY_STATUS = 'gateway-status',
  GOOGLE_OAUTH = 'google-oauth',
  PROJECT_PROVISION = 'project-provision',
  ENVIRONMENT_STATUS = 'environment-status',
  /**
   * CRUD de configuração de gateway (Mercado Pago e futuros providers) de um
   * tenant no srv-catra - backend AWS separado deste painel. Sempre roda
   * server-to-server (ver lib/helper/srv-catra.helper.ts): a privateKey do
   * Firebase de um tenant nunca é devolvida ao browser.
   */
  GATEWAY_CONFIG = 'gateway-config',
  /**
   * Exclusão DEFINITIVA do item inteiro de um tenant no srv-catra (quando o
   * cliente sai) - diferente de GATEWAY_CONFIG + DELETE, que só remove o
   * atributo `gateway`. Recurso separado para não haver como confundir os dois.
   */
  GATEWAY_TENANT = 'gateway-tenant',
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

const forbiddenError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.FORBIDDEN;
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

/**
 * Habilita ou desabilita um tenant movendo a config entre os nós.
 *
 * Desabilitar tira o app do cliente do ar: ele lê clientes/firebaseConfigs no
 * boot. Por isso a ação é explícita no corpo (`habilitar`), e não inferida do
 * estado atual — um duplo clique não deve alternar sem querer.
 */
async function handleStatusEnvironment(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const tenant = lerTenantDoCorpo(req);
  const { habilitar } = req.body ?? {};

  if (typeof habilitar !== 'boolean') {
    throw badRequestError(
      'Informe "habilitar" como true ou false para definir o status do tenant.'
    );
  }

  const environment = habilitar
    ? await habilitarEnvironment(tenant)
    : await desabilitarEnvironment(tenant, req.user?.email);

  console.info(
    `[dev-config] Tenant "${tenant}" ${habilitar ? 'habilitado' : 'desabilitado'} por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: habilitar
      ? `Tenant "${tenant}" habilitado. O app do cliente volta a inicializar.`
      : `Tenant "${tenant}" desabilitado. O app do cliente deixa de inicializar até ser habilitado de novo.`,
    data: { environment },
  });
}

/// CONEXÃO COM O GOOGLE ///

async function handleStatusGoogleOAuth(res: VercelResponse): Promise<void> {
  const status = await lerStatusConexao();

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: status.conectado
      ? 'Conta Google conectada'
      : 'Nenhuma conta Google conectada',
    data: status,
  });
}

/**
 * Devolve a URL de consentimento para o frontend redirecionar o navegador.
 *
 * O redirect não é feito aqui porque esta chamada é um XHR autenticado — quem
 * precisa navegar é a janela do usuário, não a requisição.
 */
async function handleIniciarGoogleOAuth(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const url = gerarUrlAutorizacao();

  console.info(
    `[dev-config] Fluxo de conexão Google iniciado por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: 'URL de autorização gerada',
    data: { url },
  });
}

async function handleDesconectarGoogleOAuth(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  await desconectar();

  console.info(`[dev-config] Conta Google desconectada por ${req.user?.email}`);

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message:
      'Conta desconectada do painel. Para revogar o acesso também do lado do Google, use myaccount.google.com/permissions.',
    data: { conectado: false },
  });
}

/// FIM - CONEXÃO COM O GOOGLE ///

/// PROVISIONAMENTO DE PROJETOS ///

/**
 * Lista os provisionamentos, ou devolve um só quando o tenant é informado na
 * query — é assim que a tela abre a timeline de uma criação anterior.
 */
async function handleListarProvisionamentos(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const tenantQuery = req.query?.['tenant'];
  const tenant = Array.isArray(tenantQuery) ? tenantQuery[0] : tenantQuery;

  if (tenant) {
    const normalizado = tenant.trim().toLowerCase();
    assertValidTenantName(normalizado);

    const provisionamento = await lerProvisionamento(normalizado);

    if (!provisionamento) {
      throw notFoundError(
        `Não há provisionamento registrado para "${normalizado}".`
      );
    }

    res.status(EHttpStatusCode.OK).json({
      success: true,
      message: 'Provisionamento encontrado',
      data: { provisionamento },
    });
    return;
  }

  const provisionamentos = await listarProvisionamentos();

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: 'Provisionamentos listados',
    data: {
      provisionamentos,
      total: provisionamentos.length,
      // Enviadas junto para a tela desenhar a timeline completa (inclusive as
      // etapas ainda não executadas) sem duplicar a lista no frontend.
      etapas: ORDEM_ETAPAS.map(etapa => ({
        etapa,
        rotulo: ROTULO_ETAPAS[etapa],
      })),
      locaisRtdb: LOCAIS_RTDB,
    },
  });
}

async function handleIniciarProvisionamento(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const {
    tenant,
    projectId,
    displayName,
    locationId,
    nomeEmpresa,
    adminNome,
    adminEmail,
  } = req.body ?? {};

  if (!tenant || typeof tenant !== 'string') {
    throw badRequestError('Informe o identificador do tenant.');
  }

  const tenantNormalizado = tenant.trim().toLowerCase();
  assertValidTenantName(tenantNormalizado);

  const provisionamento = await iniciarProvisionamento({
    tenant: tenantNormalizado,
    projectId:
      typeof projectId === 'string' && projectId.trim()
        ? projectId.trim().toLowerCase()
        : derivarProjectId(tenantNormalizado),
    displayName: typeof displayName === 'string' ? displayName : '',
    locationId: typeof locationId === 'string' ? locationId : LOCAIS_RTDB[0],
    nomeEmpresa: typeof nomeEmpresa === 'string' ? nomeEmpresa : '',
    admin: {
      nome: typeof adminNome === 'string' ? adminNome : '',
      email: typeof adminEmail === 'string' ? adminEmail : '',
    },
  });

  console.info(
    `[dev-config] Provisionamento de "${tenantNormalizado}" (projeto ${provisionamento.projectId}) iniciado por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Provisionamento de "${tenantNormalizado}" iniciado`,
    data: { provisionamento },
  });
}

/**
 * Executa uma etapa por chamada.
 *
 * A senha do admin do tenant viaja em cada requisição em vez de ser
 * persistida: ela só é usada na última etapa, e guardá-la no Realtime Database
 * enquanto as anteriores rodam seria expor uma credencial sem necessidade.
 */
async function handleExecutarEtapa(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const tenant = lerTenantDoCorpo(req);
  const { adminSenha } = req.body ?? {};

  const provisionamento = await executarProximaEtapa(
    tenant,
    typeof adminSenha === 'string' ? adminSenha : ''
  );

  // Índice em vez de .at(-1): o tsconfig das funções mira ES2020.
  const executada =
    provisionamento.historico[provisionamento.historico.length - 1];

  console.info(
    // Nomeia a etapa que ACABOU de rodar, lida do histórico. Antes usava
    // `etapaAtual`, que num sucesso já aponta para a próxima — dava a impressão
    // de que uma etapa tinha sido pulada.
    `[dev-config] "${tenant}": ${executada?.etapa ?? '(nenhuma)'} = ${executada?.status ?? '—'}` +
      ` | próxima: ${provisionamento.etapaAtual} | ${provisionamento.status} (por ${req.user?.email})`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Etapa processada: ${ROTULO_ETAPAS[provisionamento.etapaAtual]}`,
    data: { provisionamento },
  });
}

async function handleDescartarProvisionamento(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const tenant = lerTenantDoCorpo(req);

  const provisionamento = await descartarProvisionamento(tenant);

  console.info(
    `[dev-config] Provisionamento de "${tenant}" descartado por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Registro de provisionamento de "${tenant}" descartado. O projeto no Google, se criado, continua existindo.`,
    data: { provisionamento },
  });
}

/// FIM - PROVISIONAMENTO DE PROJETOS ///

/// CONFIGURAÇÃO DE GATEWAY (srv-catra) ///

/**
 * Extrai o token Firebase já validado por HttpHelper.checkAuthentication, para
 * repassá-lo ao srv-catra como a camada de autenticação Firebase dele. Não
 * revalida nada aqui - se o request chegou até este ponto, o token já é bom.
 */
function extrairTokenFirebase(req: ITenantAuthenticatedRequest): string {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw badRequestError('Token de autenticação ausente.');
  }

  return token;
}

/**
 * Resolve projectId/clientEmail/privateKey a partir de uma de duas fontes:
 * - syncFirebaseFromTenant: reaproveita a credencial já provisionada deste
 *   mesmo tenant no painel (lib/helper/tenant.helper.ts), sem pedir para
 *   colar de novo.
 * - serviceAccountJson: o JSON colado manualmente, para tenants que o
 *   srv-catra gerencia mas que não foram provisionados por este painel.
 * Nenhum dos dois é obrigatório - a config de gateway pode existir sem
 * credencial Firebase associada.
 */
async function resolveFirebaseFields(
  body: any
): Promise<{ projectId?: string; clientEmail?: string; privateKey?: string }> {
  const { syncFirebaseFromTenant, targetTenantId, serviceAccountJson } =
    body ?? {};

  if (syncFirebaseFromTenant) {
    const conta = await loadTenantServiceAccount(targetTenantId);
    return {
      projectId: conta.projectId,
      clientEmail: conta.clientEmail,
      privateKey: conta.privateKey,
    };
  }

  if (serviceAccountJson) {
    const {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    } = parseServiceAccount(serviceAccountJson);

    if (!projectId || !clientEmail || !privateKey) {
      throw badRequestError(
        'JSON incompleto: são necessários os campos project_id, client_email e private_key.'
      );
    }

    return { projectId, clientEmail, privateKey };
  }

  return {};
}

/**
 * O srv-catra é multitenant entre PRODUTOS, não só entre clientes - a mesma
 * tabela pode ter tenants de outros sistemas além do fitware. Este painel só
 * deve administrar os seus, então toda listagem é restrita aos tenantId que
 * contenham este valor (ver `search` em GET /gtw/config/tenant no srv-catra).
 */
const GATEWAY_CONFIG_TENANT_SCOPE = 'fitware';

/**
 * Todo tenant criado por esta tela precisa terminar com este sufixo. Derivado do
 * escopo acima de propósito: é o mesmo termo usado no `search` da listagem, então
 * um tenant fora do padrão seria criado no srv-catra e nunca apareceria na tela.
 * Vale só na criação - na edição o identificador é a chave do registro e não pode
 * mudar, e exigir o sufixo ali apenas impediria editar registros legados.
 */
const GATEWAY_CONFIG_TENANT_SUFFIX = `-${GATEWAY_CONFIG_TENANT_SCOPE}`;

/**
 * Replica a configuração no config store do Fitware (Realtime Database do próprio
 * tenant), quando o formulário escolheu um tenant para vincular. É opcional: sem
 * `firebaseTenant`, só o srv-catra é atualizado.
 *
 * A apiKey vem do create (único momento em que o srv-catra a devolve) ou, na edição,
 * de uma leitura administrativa server-to-server - ela nunca trafega pelo browser.
 */
async function sincronizarVinculoFirebase({
  req,
  firebaseTenant,
  targetTenantId,
  apiKeyDoCreate,
  ativo,
  habilitarPix,
  habilitarBoleto,
}: {
  req: ITenantAuthenticatedRequest;
  firebaseTenant: unknown;
  targetTenantId: string;
  apiKeyDoCreate?: string;
  ativo: boolean;
  habilitarPix: boolean;
  habilitarBoleto: boolean;
}): Promise<string | null> {
  if (!firebaseTenant || typeof firebaseTenant !== 'string') {
    return null;
  }

  const tenantNormalizado = firebaseTenant.trim().toLowerCase();
  assertValidTenantName(tenantNormalizado);

  const apiKey =
    apiKeyDoCreate ??
    (
      await getTenantGatewayConfig(
        extrairTokenFirebase(req),
        targetTenantId,
        true
      )
    ).apiKey;

  if (!apiKey) {
    throw badRequestError(
      `Não foi possível obter a apiKey de "${targetTenantId}" para gravar no tenant "${tenantNormalizado}".`
    );
  }

  await vincularTenantGateway({
    firebaseTenant: tenantNormalizado,
    targetTenantId,
    apiKey,
    ativo,
    habilitarPix,
    habilitarBoleto,
  });

  return tenantNormalizado;
}

async function handleListGatewayConfigs(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  validateSrvCatraEnvs();

  const [items, vinculos] = await Promise.all([
    listAllTenantsGatewayConfig(
      extrairTokenFirebase(req),
      GATEWAY_CONFIG_TENANT_SCOPE
    ),
    listarVinculos(),
  ]);

  // O vínculo não existe no srv-catra (é específico do Fitware), então é anexado
  // aqui para a tela conseguir exibi-lo e pré-selecioná-lo na edição.
  const itemsComVinculo = items.map(item => ({
    ...item,
    firebaseTenant: vinculos[item.tenantId] ?? null,
  }));

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: 'Configurações de gateway listadas',
    data: { items: itemsComVinculo, total: itemsComVinculo.length },
  });
}

async function handleCreateGatewayConfig(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  validateSrvCatraEnvs();

  const {
    targetTenantId,
    company,
    gateway,
    firebaseTenant,
    habilitarPix = false,
    habilitarBoleto = false,
  } = req.body ?? {};

  if (!targetTenantId || typeof targetTenantId !== 'string') {
    throw badRequestError(
      'Informe o identificador do tenant (targetTenantId).'
    );
  }

  if (!targetTenantId.endsWith(GATEWAY_CONFIG_TENANT_SUFFIX)) {
    throw badRequestError(
      `O identificador do tenant precisa terminar com "${GATEWAY_CONFIG_TENANT_SUFFIX}" (recebido: "${targetTenantId}").`
    );
  }

  if (!company || typeof company !== 'string') {
    throw badRequestError('Informe a descrição (company).');
  }

  if (
    !gateway?.integration ||
    !gateway?.marketplaceFee ||
    !gateway?.redirectTenantUri
  ) {
    throw badRequestError(
      'Informe gateway.integration, gateway.marketplaceFee e gateway.redirectTenantUri.'
    );
  }

  const firebaseFields = await resolveFirebaseFields(req.body);

  const payload: ICreateTenantGatewayConfigInput = {
    tenantId: targetTenantId,
    company,
    gateway,
    ...firebaseFields,
  };

  const tenant = await createTenantGatewayConfig(
    extrairTokenFirebase(req),
    payload
  );

  console.info(
    `[dev-config] Config de gateway do tenant "${targetTenantId}" criada por ${req.user?.email}`
  );

  // O srv-catra é a fonte da verdade e já gravou. Se o espelhamento no Firebase
  // falhar, a mensagem precisa deixar claro que a config existe mas o vínculo não,
  // em vez de parecer que nada foi salvo.
  let vinculado: string | null = null;

  try {
    vinculado = await sincronizarVinculoFirebase({
      req,
      firebaseTenant,
      targetTenantId,
      apiKeyDoCreate: tenant.apiKey,
      ativo: true,
      habilitarPix: Boolean(habilitarPix),
      habilitarBoleto: Boolean(habilitarBoleto),
    });
  } catch (error: any) {
    res.status(EHttpStatusCode.OK).json({
      success: false,
      message: `Configuração de "${targetTenantId}" criada no srv-catra, mas o vínculo com o Firebase falhou: ${error.message}`,
      data: { tenant },
    });
    return;
  }

  res.status(EHttpStatusCode.CREATED).json({
    success: true,
    message:
      `Configuração de gateway de "${targetTenantId}" criada com sucesso` +
      (vinculado ? ` e vinculada ao tenant "${vinculado}"` : ''),
    data: { tenant },
  });
}

async function handleUpdateGatewayConfig(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  validateSrvCatraEnvs();

  const {
    targetTenantId,
    active,
    company,
    gateway,
    firebaseTenant,
    habilitarPix = false,
    habilitarBoleto = false,
  } = req.body ?? {};

  if (!targetTenantId || typeof targetTenantId !== 'string') {
    throw badRequestError(
      'Informe o identificador do tenant (targetTenantId).'
    );
  }

  const firebaseFields = await resolveFirebaseFields(req.body);

  const payload: IUpdateTenantGatewayConfigInput = {
    active,
    company,
    gateway,
    ...firebaseFields,
  };

  const resultado = await updateTenantGatewayConfig(
    extrairTokenFirebase(req),
    targetTenantId,
    payload
  );

  console.info(
    `[dev-config] Config de gateway do tenant "${targetTenantId}" atualizada por ${req.user?.email}`
  );

  let vinculado: string | null = null;

  try {
    vinculado = await sincronizarVinculoFirebase({
      req,
      firebaseTenant,
      targetTenantId,
      // O mesmo toggle controla o gateway no srv-catra e no app do tenant.
      ativo: gateway?.active ?? true,
      habilitarPix: Boolean(habilitarPix),
      habilitarBoleto: Boolean(habilitarBoleto),
    });
  } catch (error: any) {
    res.status(EHttpStatusCode.OK).json({
      success: false,
      message: `Configuração de "${targetTenantId}" atualizada no srv-catra, mas o vínculo com o Firebase falhou: ${error.message}`,
      data: { tenant: resultado },
    });
    return;
  }

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message:
      `Configuração de gateway de "${targetTenantId}" atualizada com sucesso` +
      (vinculado ? ` e vinculada ao tenant "${vinculado}"` : ''),
    data: { tenant: resultado },
  });
}

async function handleRemoveGatewayConfig(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  validateSrvCatraEnvs();

  const { targetTenantId } = req.body ?? {};

  if (!targetTenantId || typeof targetTenantId !== 'string') {
    throw badRequestError(
      'Informe o identificador do tenant (targetTenantId).'
    );
  }

  const resultado = await removeTenantGatewayConfig(
    extrairTokenFirebase(req),
    targetTenantId
  );

  console.info(
    `[dev-config] Config de gateway do tenant "${targetTenantId}" removida por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Configuração de gateway de "${targetTenantId}" removida com sucesso`,
    data: { tenant: resultado },
  });
}

/**
 * Exclui DEFINITIVAMENTE o tenant no srv-catra. Além das travas do próprio
 * srv-catra (tenant admin, isAdmin, registros de Gateway Config), este painel
 * só exclui tenants da sua própria família (GATEWAY_CONFIG_TENANT_SCOPE) - o
 * srv-catra é compartilhado entre produtos e não pode ser usado daqui para
 * apagar tenants de outro sistema.
 */
async function handleDeleteGatewayTenant(
  req: ITenantAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  validateSrvCatraEnvs();

  const { targetTenantId } = req.body ?? {};

  if (!targetTenantId || typeof targetTenantId !== 'string') {
    throw badRequestError(
      'Informe o identificador do tenant (targetTenantId).'
    );
  }

  if (!targetTenantId.includes(GATEWAY_CONFIG_TENANT_SCOPE)) {
    throw forbiddenError(
      `Este painel só exclui tenants da família "${GATEWAY_CONFIG_TENANT_SCOPE}".`
    );
  }

  const resultado = await deleteTenantConfig(
    extrairTokenFirebase(req),
    targetTenantId
  );

  // Ação irreversível: fica registrada com quem executou, para auditoria.
  console.warn(
    `[dev-config] Tenant "${targetTenantId}" EXCLUÍDO do srv-catra por ${req.user?.email}`
  );

  res.status(EHttpStatusCode.OK).json({
    success: true,
    message: `Tenant "${targetTenantId}" excluído definitivamente`,
    data: { tenant: resultado },
  });
}

/// FIM - CONFIGURAÇÃO DE GATEWAY (srv-catra) ///

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

  if (
    recurso === EDevResource.ENVIRONMENT_STATUS &&
    req.method === EHttpMethod.POST
  ) {
    return await handleStatusEnvironment(req, res);
  }

  if (recurso === EDevResource.GOOGLE_OAUTH) {
    if (req.method === EHttpMethod.GET) {
      return await handleStatusGoogleOAuth(res);
    }

    if (req.method === EHttpMethod.POST) {
      return await handleIniciarGoogleOAuth(req, res);
    }

    if (req.method === EHttpMethod.DELETE) {
      return await handleDesconectarGoogleOAuth(req, res);
    }
  }

  if (recurso === EDevResource.PROJECT_PROVISION) {
    if (req.method === EHttpMethod.GET) {
      return await handleListarProvisionamentos(req, res);
    }

    if (req.method === EHttpMethod.POST) {
      return await handleIniciarProvisionamento(req, res);
    }

    if (req.method === EHttpMethod.PATCH) {
      return await handleExecutarEtapa(req, res);
    }

    if (req.method === EHttpMethod.DELETE) {
      return await handleDescartarProvisionamento(req, res);
    }
  }

  if (recurso === EDevResource.GATEWAY_CONFIG) {
    if (req.method === EHttpMethod.GET) {
      return await handleListGatewayConfigs(req, res);
    }

    if (req.method === EHttpMethod.POST) {
      return await handleCreateGatewayConfig(req, res);
    }

    if (req.method === EHttpMethod.PATCH) {
      return await handleUpdateGatewayConfig(req, res);
    }

    if (req.method === EHttpMethod.DELETE) {
      return await handleRemoveGatewayConfig(req, res);
    }
  }

  if (
    recurso === EDevResource.GATEWAY_TENANT &&
    req.method === EHttpMethod.DELETE
  ) {
    return await handleDeleteGatewayTenant(req, res);
  }

  // Os erros sobem para withErrorHandling, que preserva o status definido em
  // cada um (400, 404) em vez de achatar tudo em 500.
  throw notFoundError(
    `Recurso não encontrado: ${req.method} ${DEV_RESOURCE_HEADER}=${recurso ?? '(vazio)'}`
  );
}

export default withErrorHandling(devConfigHandler);
