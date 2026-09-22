import { IFirebaseConfigCliente } from './environment-config.helper';
import { obterAccessToken } from './google-oauth.helper';
import { EHttpStatusCode } from './sistema.helper';

/**
 * Cliente fino das APIs REST do Google usadas no provisionamento de um projeto
 * Firebase novo.
 *
 * Usa fetch direto em vez do pacote googleapis: só precisamos de ~10 endpoints,
 * e o googleapis carrega o discovery de centenas de APIs — peso que não se
 * justifica num bundle serverless.
 *
 * Todas as chamadas vão autenticadas com o access token da conta Google
 * conectada (ver google-oauth.helper.ts); a service account do fitmanager-util
 * não serve aqui porque não pode criar projetos fora de uma Organização.
 */

///MODELS///

export interface IProjetoCriado {
  projectId: string;
  projectNumber: string;
}

export interface IInstanciaRtdb {
  name: string;
  databaseUrl: string;
  type: string;
  state: string;
}

export interface IAppWeb {
  appId: string;
  displayName?: string;
}

export interface IServiceAccountJson {
  project_id: string;
  client_email: string;
  private_key: string;
}

///FIM - MODELS///

/// ENUMS ///

export enum EGoogleApi {
  RESOURCE_MANAGER = 'https://cloudresourcemanager.googleapis.com/v1',
  SERVICE_USAGE = 'https://serviceusage.googleapis.com/v1',
  FIREBASE = 'https://firebase.googleapis.com/v1beta1',
  FIREBASE_DATABASE = 'https://firebasedatabase.googleapis.com/v1beta',
  IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com/admin/v2',
  IAM = 'https://iam.googleapis.com/v1',
}

/// FIM - ENUMS ///

/// CONSTANTES ///

/**
 * APIs habilitadas no projeto recém-criado. Sem elas, as chamadas seguintes
 * falham com SERVICE_DISABLED — o console do Firebase faz essa habilitação nos
 * bastidores, mas via API ela é explícita.
 */
export const APIS_NECESSARIAS = [
  'firebase.googleapis.com',
  'firebasedatabase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'iam.googleapis.com',
  'serviceusage.googleapis.com',
  'cloudresourcemanager.googleapis.com',
];

/** Papel que o próprio console do Firebase concede à SA firebase-adminsdk-*. */
export const PAPEL_ADMIN_SDK = 'roles/firebase.sdkAdminServiceAgent';

/** Id da conta de serviço criada em cada projeto de tenant. */
export const ACCOUNT_ID_PAINEL = 'painel-fitware';

/**
 * Regras do Google para projectId: 6 a 30 caracteres, começa por letra, só
 * minúsculas/dígitos/hífen, não termina em hífen.
 *
 * Deliberadamente mais estrito que o TENANT_NAME_PATTERN (tenant.helper.ts),
 * que aceita 2 caracteres e início por dígito — válido como subdomínio, mas
 * recusado pelo Google.
 */
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

/** Limites do nome exibido do projeto no console do Google. */
export const DISPLAY_NAME_MIN = 4;
export const DISPLAY_NAME_MAX = 30;

/// FIM - CONSTANTES ///

/// ERROS E VALIDAÇÃO ///

const badRequestError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.BAD_REQUEST;
  return error;
};

export function assertValidProjectId(projectId: string): void {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw badRequestError(
      'ID de projeto inválido. Use de 6 a 30 caracteres, apenas letras minúsculas, números e hífen, começando por letra e sem terminar em hífen.'
    );
  }
}

/**
 * O nome exibido do projeto no console aceita de 4 a 30 caracteres. Validar
 * aqui evita perder a criação no meio da chamada com um erro cru do Google
 * (`field [display_name] has issue [...]`).
 */
export function assertValidDisplayName(displayName: string): void {
  const nome = displayName?.trim() ?? '';

  if (nome.length < DISPLAY_NAME_MIN || nome.length > DISPLAY_NAME_MAX) {
    throw badRequestError(
      `O nome exibido do projeto deve ter de ${DISPLAY_NAME_MIN} a ${DISPLAY_NAME_MAX} caracteres (recebido: ${nome.length}).`
    );
  }
}

/**
 * Deriva um projectId válido a partir do nome do tenant, respeitando as regras
 * do Google. O usuário pode editar o valor sugerido no formulário.
 */
export function derivarProjectId(tenant: string): string {
  const base = tenant
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  const comLetraInicial = /^[a-z]/.test(base) ? base : `fw-${base}`;
  const truncado = comLetraInicial.slice(0, 30).replace(/-+$/, '');

  return truncado.length >= 6 ? truncado : `${truncado}-fitware`.slice(0, 30);
}

/// FIM - ERROS E VALIDAÇÃO ///

/// HTTP ///

export enum EMotivoErroGoogle {
  JA_EXISTE = 'JA_EXISTE',
  /** Recurso recém-criado ainda não visível, ou API habilitada há pouco. */
  PROPAGACAO = 'PROPAGACAO',
  QUOTA = 'QUOTA',
  EXIGE_BILLING = 'EXIGE_BILLING',
  /** O Identity Toolkit não tem configuração criada para o projeto. */
  CONFIG_AUSENTE = 'CONFIG_AUSENTE',
}

export interface IErroGoogle extends Error {
  status?: number;
  motivo?: EMotivoErroGoogle;
}

export const motivoDoErro = (erro: unknown): EMotivoErroGoogle | undefined =>
  (erro as IErroGoogle)?.motivo;

/**
 * Traduz os erros mais comuns do Google para algo que o painel consiga tratar,
 * mantendo a mensagem original como detalhe.
 *
 * A ordem importa: CONFIGURATION_NOT_FOUND é testado antes de billing porque
 * as duas mensagens podem aparecer no mesmo fluxo do Identity Toolkit, e é a
 * config ausente que descreve melhor o que o usuário precisa resolver.
 */
function traduzirErro(status: number, mensagem: string): IErroGoogle {
  const erro = new Error(mensagem) as IErroGoogle;
  erro.status = status;

  if (/CONFIGURATION_NOT_FOUND/i.test(mensagem)) {
    erro.motivo = EMotivoErroGoogle.CONFIG_AUSENTE;
  } else if (
    /already exists|ALREADY_EXISTS|Requested entity already exists/i.test(
      mensagem
    )
  ) {
    erro.motivo = EMotivoErroGoogle.JA_EXISTE;
  } else if (
    (status === EHttpStatusCode.FORBIDDEN &&
      /SERVICE_DISABLED|has not been used|is disabled|Permission .* denied/i.test(
        mensagem
      )) ||
    /does not exist|may not exist/i.test(mensagem)
  ) {
    // Confirmado na Fase 0: logo após criar o projeto, estas mensagens são
    // consistência eventual do IAM, não falta real de permissão.
    erro.motivo = EMotivoErroGoogle.PROPAGACAO;
  } else if (/BILLING_NOT_ENABLED|billing|Blaze/i.test(mensagem)) {
    erro.motivo = EMotivoErroGoogle.EXIGE_BILLING;
  } else if (/quota|limit/i.test(mensagem)) {
    erro.motivo = EMotivoErroGoogle.QUOTA;
  }

  return erro;
}

/**
 * @param quotaProjectId Projeto ao qual atribuir a cota da chamada.
 *
 * `firebasedatabase` e `identitytoolkit` recusam credenciais de usuário sem um
 * "quota project" definido ("requires a quota project, which is not set by
 * default"). Como provisionamos em nome de um usuário, e não de uma service
 * account, essas duas precisam do header `x-goog-user-project` apontando para
 * o projeto que está sendo configurado — onde a API acabou de ser habilitada e
 * onde a conta conectada é Owner.
 *
 * As demais APIs usadas aqui não exigem o header, então ele é opt-in por
 * chamada em vez de global.
 */
async function chamar<T>(
  metodo: string,
  url: string,
  corpo?: unknown,
  quotaProjectId?: string
): Promise<T> {
  const accessToken = await obterAccessToken();

  const resposta = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(quotaProjectId ? { 'x-goog-user-project': quotaProjectId } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });

  const texto = await resposta.text();
  let dados: any = null;

  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = { raw: texto };
  }

  if (!resposta.ok) {
    throw traduzirErro(
      resposta.status,
      dados?.error?.message || dados?.raw || `HTTP ${resposta.status}`
    );
  }

  return dados as T;
}

const dormir = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

interface IOperacao<T> {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: T;
}

/**
 * Faz poll de uma Long Running Operation até done. O timeout é conservador
 * porque cada etapa do provisionamento roda numa invocação própria da Vercel,
 * com maxDuration de 60s — quem chama é responsável por escolher um valor que
 * caiba nessa janela.
 */
async function aguardarOperacao<T>(
  baseUrl: string,
  nomeOperacao: string,
  { timeoutMs = 45000, intervaloMs = 2500 } = {}
): Promise<T> {
  const limite = Date.now() + timeoutMs;

  while (Date.now() < limite) {
    const operacao = await chamar<IOperacao<T>>(
      'GET',
      `${baseUrl}/${nomeOperacao}`
    );

    if (operacao.done) {
      if (operacao.error) {
        throw traduzirErro(
          EHttpStatusCode.INTERNAL_SERVER_ERROR,
          operacao.error.message
        );
      }
      return (operacao.response ?? {}) as T;
    }

    await dormir(intervaloMs);
  }

  throw new Error(
    `A operação do Google não concluiu a tempo. Use "Tentar novamente" — a etapa detecta o que já foi criado.`
  );
}

/**
 * Repete enquanto o erro for de propagação.
 *
 * Confirmado empiricamente na Fase 0: um projeto recém-criado devolve
 * PERMISSION_DENIED em `firebasedatabase.instances.create` e "does not exist"
 * para uma service account criada segundos antes — e os dois passam sozinhos
 * quando o projeto assenta. O IAM do Google é eventualmente consistente.
 */
export async function comRetry<T>(
  fn: () => Promise<T>,
  // Orçamento curto de propósito: 3 + 6 = 9s dormindo, mais as chamadas, cabe
  // com folga no maxDuration de 60s da função mesmo somado ao aguardarOperacao.
  // Propagação que leva mais que isso é tratada ENTRE requisições, pela máquina
  // de estados — ver "aguardando propagação" em provisionamento.helper.ts.
  { tentativas = 3, backoffMs = 3000 } = {}
): Promise<T> {
  let ultimoErro: IErroGoogle | undefined;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro as IErroGoogle;

      if (
        ultimoErro.motivo !== EMotivoErroGoogle.PROPAGACAO ||
        tentativa === tentativas
      ) {
        throw erro;
      }

      await dormir(backoffMs * tentativa);
    }
  }

  throw ultimoErro;
}

/// FIM - HTTP ///

/// PROJETO ///

/**
 * Devolve o projeto quando ele existe E a conta conectada consegue lê-lo.
 *
 * Devolve null em 404 e também em **403**: o Resource Manager responde
 * "The caller does not have permission" tanto para projeto inexistente quanto
 * para projeto de outra conta, de propósito, para não revelar quais IDs já
 * estão em uso. Tratar 403 como erro fazia a criação de um projeto novo falhar
 * antes mesmo de ser tentada.
 *
 * Os dois casos que caem em null são indistinguíveis aqui — quem decide é o
 * POST de criação, que responde ALREADY_EXISTS numa colisão real.
 */
export async function lerProjeto(projectId: string): Promise<{
  projectNumber: string;
  lifecycleState: string;
  name?: string;
} | null> {
  try {
    return await chamar(
      'GET',
      `${EGoogleApi.RESOURCE_MANAGER}/projects/${projectId}`
    );
  } catch (erro) {
    const status = (erro as IErroGoogle).status;

    if (
      status === EHttpStatusCode.NOT_FOUND ||
      status === EHttpStatusCode.FORBIDDEN
    ) {
      return null;
    }

    throw erro;
  }
}

/**
 * Cria o projeto no Google Cloud.
 *
 * `projectNumberEsperado` é a salvaguarda contra adotar um projeto que não é
 * nosso. Toda etapa aqui é idempotente para permitir "tentar novamente", mas
 * "o projeto já existe" tem duas causas muito diferentes: ou nós o criamos numa
 * tentativa anterior deste mesmo provisionamento, ou o ID colidiu com um
 * projeto de verdade — possivelmente um tenant em produção. Só o primeiro caso
 * pode seguir adiante; o segundo precisa parar, porque as etapas seguintes
 * escreveriam nesse projeto alheio.
 */
export async function criarProjeto({
  projectId,
  displayName,
  projectNumberEsperado,
}: {
  projectId: string;
  displayName: string;
  projectNumberEsperado?: string;
}): Promise<IProjetoCriado> {
  assertValidProjectId(projectId);
  assertValidDisplayName(displayName);

  const existente = await lerProjeto(projectId);

  if (existente) {
    // O número bate quando uma tentativa anterior registrou a criação. O nome
    // cobre o caso em que a criação deu certo no Google mas a invocação caiu
    // antes de gravar o número — sem isso, "Tentar novamente" ficaria travado
    // para sempre num projeto que é nosso.
    const criadoPorEsteProvisionamento =
      (!!projectNumberEsperado &&
        existente.projectNumber === projectNumberEsperado) ||
      existente.name === displayName;

    if (criadoPorEsteProvisionamento) {
      return { projectId, projectNumber: existente.projectNumber };
    }

    throw badRequestError(
      `O projeto "${projectId}" já existe no Google Cloud e não foi criado por este provisionamento. ` +
        'Escolha outro ID de projeto — seguir adiante alteraria um projeto existente.'
    );
  }

  let operacao: IOperacao<IProjetoCriado>;

  try {
    operacao = await chamar<IOperacao<IProjetoCriado>>(
      'POST',
      `${EGoogleApi.RESOURCE_MANAGER}/projects`,
      { projectId, name: displayName }
    );
  } catch (erro) {
    // Chegar aqui com JA_EXISTE significa que o ID está tomado por um projeto
    // que a conta conectada não enxerga — de outra conta, ou apagado e ainda
    // no período de retenção de 30 dias.
    if ((erro as IErroGoogle).motivo === EMotivoErroGoogle.JA_EXISTE) {
      throw badRequestError(
        `O ID de projeto "${projectId}" já está em uso no Google Cloud, por um projeto que esta conta não acessa. ` +
          'IDs são únicos globalmente e ficam reservados por 30 dias após a exclusão. Escolha outro.'
      );
    }

    throw erro;
  }

  const resultado = await aguardarOperacao<IProjetoCriado>(
    EGoogleApi.RESOURCE_MANAGER,
    operacao.name,
    { timeoutMs: 45000 }
  );

  return {
    projectId,
    projectNumber:
      resultado.projectNumber ??
      (await lerProjeto(projectId))?.projectNumber ??
      '',
  };
}

/// FIM - PROJETO ///

/// APIS ///

export async function habilitarApis(projectId: string): Promise<void> {
  const operacao = await chamar<IOperacao<unknown>>(
    'POST',
    `${EGoogleApi.SERVICE_USAGE}/projects/${projectId}/services:batchEnable`,
    { serviceIds: APIS_NECESSARIAS }
  );

  await aguardarOperacao(EGoogleApi.SERVICE_USAGE, operacao.name, {
    timeoutMs: 45000,
  });
}

/// FIM - APIS ///

/// FIREBASE ///

export async function firebaseJaAdicionado(
  projectId: string
): Promise<boolean> {
  try {
    await chamar('GET', `${EGoogleApi.FIREBASE}/projects/${projectId}`);
    return true;
  } catch (erro) {
    const status = (erro as IErroGoogle).status;

    if (
      status === EHttpStatusCode.NOT_FOUND ||
      status === EHttpStatusCode.FORBIDDEN
    ) {
      return false;
    }

    throw erro;
  }
}

export async function adicionarFirebase(projectId: string): Promise<void> {
  if (await firebaseJaAdicionado(projectId)) {
    return;
  }

  const operacao = await comRetry(() =>
    chamar<IOperacao<unknown>>(
      'POST',
      `${EGoogleApi.FIREBASE}/projects/${projectId}:addFirebase`,
      {}
    )
  );

  await aguardarOperacao(EGoogleApi.FIREBASE, operacao.name, {
    timeoutMs: 45000,
  });
}

/// FIM - FIREBASE ///

/// REALTIME DATABASE ///

export const nomeInstanciaPadrao = (projectId: string): string =>
  `${projectId}-default-rtdb`;

export async function lerInstanciaRtdb(
  projectId: string,
  locationId: string
): Promise<IInstanciaRtdb | null> {
  const databaseId = nomeInstanciaPadrao(projectId);

  try {
    return await chamar<IInstanciaRtdb>(
      'GET',
      `${EGoogleApi.FIREBASE_DATABASE}/projects/${projectId}/locations/${locationId}/instances/${databaseId}`,
      undefined,
      projectId
    );
  } catch (erro) {
    if ((erro as IErroGoogle).status === EHttpStatusCode.NOT_FOUND) {
      return null;
    }
    throw erro;
  }
}

/**
 * Cria a instância DEFAULT do Realtime Database.
 *
 * A documentação do endpoint diz "Only available for projects on the Blaze
 * plan", mas o provider Terraform qualifica isso como válido para instâncias
 * *user*, e aceita DEFAULT_DATABASE. A Fase 0 (scripts/spike-provisionamento.js)
 * existe para confirmar o comportamento real no Spark.
 */
export async function criarInstanciaRtdb(
  projectId: string,
  locationId: string
): Promise<IInstanciaRtdb> {
  const existente = await lerInstanciaRtdb(projectId, locationId);

  if (existente) {
    return existente;
  }

  const databaseId = nomeInstanciaPadrao(projectId);

  return comRetry(() =>
    chamar<IInstanciaRtdb>(
      'POST',
      `${EGoogleApi.FIREBASE_DATABASE}/projects/${projectId}/locations/${locationId}/instances?databaseId=${databaseId}`,
      { type: 'DEFAULT_DATABASE' },
      projectId
    )
  );
}

/// FIM - REALTIME DATABASE ///

/// AUTHENTICATION ///

interface IConfigIdentityToolkit {
  signIn?: { email?: { enabled?: boolean; passwordRequired?: boolean } };
}

/**
 * Liga o provider e-mail/senha.
 *
 * Só funciona se a configuração do Identity Toolkit já existir no projeto. Num
 * projeto novo no plano Spark ela NÃO existe, e não há como criá-la por API —
 * medido na Fase 0:
 *
 *   - `identityPlatform:initializeAuth` responde
 *     "BILLING_NOT_ENABLED : Identity Platform feature requires billing to be enabled";
 *   - `accounts:signUp` com a apiKey responde CONFIGURATION_NOT_FOUND, ou seja,
 *     o provider também não vem ligado por padrão.
 *
 * Por isso a etapa correspondente trata CONFIG_AUSENTE como ação manual em vez
 * de erro: o admin habilita o Authentication uma vez no console e o fluxo
 * retoma daqui, quando este PATCH passa a funcionar.
 */
export async function habilitarLoginEmailSenha(
  projectId: string
): Promise<boolean> {
  const config = await comRetry(() =>
    chamar<IConfigIdentityToolkit>(
      'PATCH',
      `${EGoogleApi.IDENTITY_TOOLKIT}/projects/${projectId}/config?updateMask=signIn.email`,
      { signIn: { email: { enabled: true, passwordRequired: true } } },
      projectId
    )
  );

  return !!config?.signIn?.email?.enabled;
}

/// FIM - AUTHENTICATION ///

/// APP WEB ///

export async function listarAppsWeb(projectId: string): Promise<IAppWeb[]> {
  const resposta = await chamar<{ apps?: IAppWeb[] }>(
    'GET',
    `${EGoogleApi.FIREBASE}/projects/${projectId}/webApps`
  );

  return resposta.apps ?? [];
}

export async function criarAppWeb(
  projectId: string,
  displayName: string
): Promise<string> {
  const existentes = await listarAppsWeb(projectId);

  if (existentes.length > 0) {
    return existentes[0].appId;
  }

  const operacao = await comRetry(() =>
    chamar<IOperacao<IAppWeb>>(
      'POST',
      `${EGoogleApi.FIREBASE}/projects/${projectId}/webApps`,
      { displayName }
    )
  );

  const app = await aguardarOperacao<IAppWeb>(
    EGoogleApi.FIREBASE,
    operacao.name,
    { timeoutMs: 45000 }
  );

  return app.appId;
}

/**
 * Lê a config client-side do app Web — o mesmo objeto que o app do tenant passa
 * para initializeApp().
 *
 * `storageBucket` volta ausente em projetos Spark, porque o bucket padrão do
 * Cloud Storage passou a exigir Blaze em out/2024. Preenchemos com o nome
 * convencional para manter a config completa; o bucket em si só passa a existir
 * quando o projeto for para o Blaze.
 */
export async function lerConfigAppWeb(
  projectId: string,
  appId: string
): Promise<IFirebaseConfigCliente> {
  const config = await chamar<Partial<IFirebaseConfigCliente>>(
    'GET',
    `${EGoogleApi.FIREBASE}/projects/${projectId}/webApps/${appId}/config`
  );

  return {
    apiKey: config.apiKey ?? '',
    authDomain: config.authDomain ?? `${projectId}.firebaseapp.com`,
    databaseURL: config.databaseURL ?? '',
    projectId: config.projectId ?? projectId,
    storageBucket: config.storageBucket || `${projectId}.firebasestorage.app`,
    messagingSenderId: config.messagingSenderId ?? '',
    appId: config.appId ?? appId,
    ...(config.measurementId ? { measurementId: config.measurementId } : {}),
  };
}

/// FIM - APP WEB ///

/// SERVICE ACCOUNT ///

const emailServiceAccount = (projectId: string): string =>
  `${ACCOUNT_ID_PAINEL}@${projectId}.iam.gserviceaccount.com`;

/**
 * As chamadas ao IAM precisam do `x-goog-user-project` apontando para o projeto
 * do tenant.
 *
 * Sem ele, o Google cobra a cota no projeto dono do OAuth Client — o
 * fitmanager-util — e responde "Identity and Access Management (IAM) API has
 * not been used in project <número do fitmanager-util>". A API está habilitada
 * no projeto novo (etapa 2), não no do OAuth Client, e é lá que a cota deve
 * cair.
 */
async function criarContaServico(projectId: string): Promise<string> {
  const email = emailServiceAccount(projectId);

  try {
    await chamar(
      'GET',
      `${EGoogleApi.IAM}/projects/${projectId}/serviceAccounts/${email}`,
      undefined,
      projectId
    );
    return email;
  } catch (erro) {
    if ((erro as IErroGoogle).status !== EHttpStatusCode.NOT_FOUND) {
      throw erro;
    }
  }

  const conta = await comRetry(() =>
    chamar<{ email: string }>(
      'POST',
      `${EGoogleApi.IAM}/projects/${projectId}/serviceAccounts`,
      {
        accountId: ACCOUNT_ID_PAINEL,
        serviceAccount: { displayName: 'Painel Fitware (provisionado)' },
      },
      projectId
    )
  );

  return conta.email;
}

interface IPoliticaIam {
  bindings?: { role: string; members: string[] }[];
  etag?: string;
  version?: number;
}

async function concederPapel(
  projectId: string,
  email: string,
  papel: string
): Promise<void> {
  const politica = await chamar<IPoliticaIam>(
    'POST',
    `${EGoogleApi.RESOURCE_MANAGER}/projects/${projectId}:getIamPolicy`,
    {}
  );

  const membro = `serviceAccount:${email}`;
  const bindings = politica.bindings ?? [];
  const existente = bindings.find(binding => binding.role === papel);

  if (existente?.members?.includes(membro)) {
    return;
  }

  if (existente) {
    existente.members = [...(existente.members ?? []), membro];
  } else {
    bindings.push({ role: papel, members: [membro] });
  }

  await chamar(
    'POST',
    `${EGoogleApi.RESOURCE_MANAGER}/projects/${projectId}:setIamPolicy`,
    { policy: { ...politica, bindings } }
  );
}

/**
 * Cria a conta de serviço do painel no projeto do tenant, concede o papel de
 * admin do Firebase e emite uma chave privada.
 *
 * O JSON devolvido é o mesmo arquivo que hoje se baixa à mão no console e se
 * cola na tela de Configuração de Tenants.
 */
export async function provisionarServiceAccount(
  projectId: string
): Promise<IServiceAccountJson> {
  const email = await criarContaServico(projectId);

  await concederPapel(projectId, email, PAPEL_ADMIN_SDK);

  const chave = await comRetry(() =>
    chamar<{ privateKeyData: string }>(
      'POST',
      `${EGoogleApi.IAM}/projects/${projectId}/serviceAccounts/${email}/keys`,
      { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE' },
      projectId
    )
  );

  return JSON.parse(
    Buffer.from(chave.privateKeyData, 'base64').toString('utf8')
  ) as IServiceAccountJson;
}

/// FIM - SERVICE ACCOUNT ///
