import { Auth } from 'firebase-admin/auth';
import { Database, getDatabase } from 'firebase-admin/database';
import {
  EEnvironmentConfigCollection,
  IFirebaseConfigCliente,
  saveEnvironmentConfig,
} from './environment-config.helper';
import {
  adicionarFirebase,
  assertValidDisplayName,
  assertValidProjectId,
  EMotivoErroGoogle,
  motivoDoErro,
  criarAppWeb,
  criarInstanciaRtdb,
  criarProjeto,
  habilitarApis,
  habilitarLoginEmailSenha,
  lerConfigAppWeb,
  provisionarServiceAccount,
} from './google-cloud.helper';
import { EHttpStatusCode } from './sistema.helper';
import {
  assertValidTenantName,
  EConfigCollection,
  getConfigApp,
  getTenantContext,
  saveTenantServiceAccount,
} from './tenant.helper';

/**
 * Máquina de estados do provisionamento de um tenant.
 *
 * Cada chamada executa UMA etapa e devolve o estado atualizado. Isso resolve
 * três problemas de uma vez:
 *
 *  - cabe no maxDuration da função Vercel, já que nenhuma invocação precisa
 *    aguardar a sequência inteira (que leva 1 a 3 minutos no total);
 *  - dá à tela um progresso real, etapa a etapa, em vez de um spinner cego;
 *  - permite retomar de onde parou, porque o estado vive no Realtime Database
 *    e não na memória da invocação.
 *
 * Toda etapa é idempotente: verifica o que já existe antes de criar. "Tentar
 * novamente" é sempre seguro.
 */

///MODELS///

export interface IDadosProvisionamento {
  projectNumber?: string;
  databaseURL?: string;
  appId?: string;
  clientEmail?: string;
}

export interface IEventoProvisionamento {
  etapa: EEtapaProvisionamento;
  status: EStatusEvento;
  dataHora: string;
  duracaoMs: number;
  resumo: string;
  erro?: string;
}

export interface IAdminTenant {
  nome: string;
  email: string;
}

/**
 * Instrução para o passo que o Google não deixa automatizar no plano Spark.
 * Fica gravada no registro para a tela conseguir mostrá-la mesmo depois de um
 * F5 ou de outra pessoa abrir o provisionamento.
 */
export interface IAcaoManual {
  etapa: EEtapaProvisionamento;
  titulo: string;
  motivo: string;
  url: string;
  instrucoes: string[];
}

export interface IProvisionamento {
  tenant: string;
  projectId: string;
  displayName: string;
  locationId: string;
  nomeEmpresa: string;
  admin: IAdminTenant;
  status: EStatusProvisionamento;
  etapaAtual: EEtapaProvisionamento;
  etapasConcluidas: EEtapaProvisionamento[];
  dados: IDadosProvisionamento;
  historico: IEventoProvisionamento[];
  erro?: string;
  acaoManual?: IAcaoManual;
  /** Quantas vezes a etapa atual foi tentada e bateu em propagação. */
  tentativasEtapaAtual?: number;
  /** Sinaliza ao frontend que vale esperar mais antes de chamar de novo. */
  aguardandoPropagacao?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

///FIM - MODELS///

/// ENUMS ///

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

export enum EProvisionamentoCollection {
  PROVISIONAMENTOS = 'clientes/provisionamentos',
}

/** Nós que o app de um tenant espera encontrar já no primeiro acesso. */
enum ETenantSeedCollection {
  GATEWAY_CONFIG = 'tenantConfig/gatewayConfig',
  NOMENCLATURA_CONFIG = 'nomenclaturaConfig',
  WHATSAPP_CONFIG = 'whatsAppConfig',
  DADOS_USUARIO = 'dados-usuario',
}

/**
 * Perfil/status do usuário DENTRO do projeto do tenant. Definidos aqui de
 * propósito: os enums de sistema.helper.ts descrevem os usuários do painel,
 * que têm outro conjunto de papéis (Cadastrador/Visualizador) — a coincidência
 * dos literais "Admin" e "Ativo" é acidental, não um domínio compartilhado.
 */
const TENANT_ROLE_ADMIN = 'Admin';
const TENANT_STATUS_ATIVO = 'Ativo';

/// FIM - ENUMS ///

/// CONSTANTES ///

/** Ordem de execução. A posição no array é o que define "a próxima etapa". */
export const ORDEM_ETAPAS: EEtapaProvisionamento[] = [
  EEtapaProvisionamento.CRIAR_PROJETO,
  EEtapaProvisionamento.HABILITAR_APIS,
  EEtapaProvisionamento.ADICIONAR_FIREBASE,
  EEtapaProvisionamento.CRIAR_RTDB,
  EEtapaProvisionamento.HABILITAR_AUTH,
  EEtapaProvisionamento.CRIAR_APP_WEB,
  EEtapaProvisionamento.CRIAR_SERVICE_ACCOUNT,
  EEtapaProvisionamento.SEMEAR_DADOS,
];

export const ROTULO_ETAPAS: Record<EEtapaProvisionamento, string> = {
  [EEtapaProvisionamento.CRIAR_PROJETO]: 'Criar projeto no Google Cloud',
  [EEtapaProvisionamento.HABILITAR_APIS]: 'Habilitar APIs necessárias',
  [EEtapaProvisionamento.ADICIONAR_FIREBASE]: 'Adicionar Firebase ao projeto',
  [EEtapaProvisionamento.CRIAR_RTDB]: 'Criar Realtime Database',
  [EEtapaProvisionamento.HABILITAR_AUTH]: 'Habilitar login por e-mail/senha',
  [EEtapaProvisionamento.CRIAR_APP_WEB]:
    'Criar app Web e registrar environment',
  [EEtapaProvisionamento.CRIAR_SERVICE_ACCOUNT]:
    'Emitir conta de serviço e registrar tenant',
  [EEtapaProvisionamento.SEMEAR_DADOS]: 'Semear dados iniciais e criar admin',
  [EEtapaProvisionamento.CONCLUIDO]: 'Concluído',
};

/** Regiões onde o Realtime Database pode ser criado. */
export const LOCAIS_RTDB = ['us-central1', 'europe-west1', 'asia-southeast1'];

const SENHA_MINIMA = 6;

/**
 * Quantas vezes uma etapa pode bater em propagação antes de virar erro de fato.
 *
 * Com a pausa que o frontend dá entre as chamadas, isso dá alguns minutos de
 * tolerância — sem que nenhuma invocação individual chegue perto do
 * maxDuration de 60s da função. O backoff longo mora aqui, entre requisições,
 * e não dentro de uma delas.
 */
const LIMITE_TENTATIVAS_PROPAGACAO = 10;

/// FIM - CONSTANTES ///

/// ERROS ///

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
 * Erro que sinaliza "não é falha, é a sua vez": interrompe a sequência e
 * carrega as instruções do que precisa ser feito no console.
 */
const acaoManualError = (acao: IAcaoManual): Error => {
  const error: any = new Error(acao.motivo);
  error.acaoManual = acao;
  return error;
};

const acaoManualDoErro = (erro: unknown): IAcaoManual | undefined =>
  (erro as { acaoManual?: IAcaoManual })?.acaoManual;

/// FIM - ERROS ///

/// PERSISTÊNCIA ///

const getReferencia = (tenant: string) =>
  getDatabase(getConfigApp()).ref(
    `${EProvisionamentoCollection.PROVISIONAMENTOS}/${tenant}`
  );

/**
 * Normaliza o registro lido do Realtime Database.
 *
 * O RTDB não guarda arrays vazios nem chaves com valor undefined, então
 * `historico` e `etapasConcluidas` voltam ausentes enquanto ninguém gravou
 * nada neles — e um `.length` direto quebraria.
 */
const normalizar = (registro: IProvisionamento): IProvisionamento => ({
  ...registro,
  etapasConcluidas: registro.etapasConcluidas ?? [],
  historico: registro.historico ?? [],
  dados: registro.dados ?? {},
  tentativasEtapaAtual: registro.tentativasEtapaAtual ?? 0,
});

export async function lerProvisionamento(
  tenant: string
): Promise<IProvisionamento | null> {
  assertValidTenantName(tenant);

  const snapshot = await getReferencia(tenant).once('value');
  const registro = snapshot.val() as IProvisionamento | null;

  return registro ? normalizar(registro) : null;
}

/** Lista todos os provisionamentos, do mais recente para o mais antigo. */
export async function listarProvisionamentos(): Promise<IProvisionamento[]> {
  const snapshot = await getDatabase(getConfigApp())
    .ref(EProvisionamentoCollection.PROVISIONAMENTOS)
    .once('value');

  const valor = (snapshot.val() ?? {}) as Record<string, IProvisionamento>;

  return Object.values(valor)
    .map(normalizar)
    .sort((a, b) => (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''));
}

/**
 * Remove o registro de um provisionamento. Serve para descartar uma tentativa
 * abortada — nunca apaga o projeto no Google, que é irreversível e fica fora
 * do escopo do painel.
 */
export async function descartarProvisionamento(
  tenant: string
): Promise<IProvisionamento> {
  const registro = await lerProvisionamento(tenant);

  if (!registro) {
    throw notFoundError(`Não há provisionamento registrado para "${tenant}".`);
  }

  await getReferencia(tenant).remove();

  return registro;
}

/// FIM - PERSISTÊNCIA ///

/// INÍCIO DO FLUXO ///

/**
 * Recusa iniciar um provisionamento para um tenant que já está registrado no
 * fitmanager-util.
 *
 * Sem esta checagem, digitar o nome de um cliente que já existe faria as
 * etapas 6 e 7 reescreverem `clientes/firebaseConfigs/{tenant}` e
 * `clientes/serviceAccounts/{tenant}` apontando para o projeto novo e vazio —
 * o app daquele cliente passaria a abrir um banco sem dados. O projeto antigo
 * continuaria no Google, mas o cliente sairia do ar.
 *
 * Só vale para um começo do zero: retomar um provisionamento que falhou
 * precisa justamente reescrever esses nós.
 */
async function assertTenantLivre(tenant: string): Promise<void> {
  const database = getDatabase(getConfigApp());

  const [serviceAccount, firebaseConfig] = await Promise.all([
    database
      .ref(`${EConfigCollection.SERVICE_ACCOUNTS}/${tenant}`)
      .once('value'),
    database
      .ref(`${EEnvironmentConfigCollection.FIREBASE_CONFIGS}/${tenant}`)
      .once('value'),
  ]);

  if (!serviceAccount.exists() && !firebaseConfig.exists()) {
    return;
  }

  const ondeExiste = [
    serviceAccount.exists() ? 'Configuração de Tenants' : null,
    firebaseConfig.exists() ? 'Configuração de Environments' : null,
  ]
    .filter(Boolean)
    .join(' e ');

  throw badRequestError(
    `O tenant "${tenant}" já está cadastrado em ${ondeExiste}. ` +
      'Criar um projeto com esse nome sobrescreveria o cadastro atual e tiraria o cliente do ar. ' +
      'Use outro nome de tenant, ou remova o cadastro existente antes.'
  );
}

export async function iniciarProvisionamento({
  tenant,
  projectId,
  displayName,
  locationId,
  nomeEmpresa,
  admin,
}: {
  tenant: string;
  projectId: string;
  displayName: string;
  locationId: string;
  nomeEmpresa: string;
  admin: IAdminTenant;
}): Promise<IProvisionamento> {
  assertValidTenantName(tenant);
  assertValidProjectId(projectId);

  // Resolvido aqui, e não na etapa 1, para o limite de 30 caracteres do Google
  // ser recusado antes de criarmos o registro do provisionamento.
  const nomeExibido = displayName?.trim() || tenant;
  assertValidDisplayName(nomeExibido);

  if (!LOCAIS_RTDB.includes(locationId)) {
    throw badRequestError(
      `Região inválida para o Realtime Database. Use uma destas: ${LOCAIS_RTDB.join(', ')}.`
    );
  }

  if (!admin?.nome?.trim() || !admin?.email?.trim()) {
    throw badRequestError('Informe nome e e-mail do administrador do tenant.');
  }

  const existente = await lerProvisionamento(tenant);

  if (existente && existente.status !== EStatusProvisionamento.ERRO) {
    throw badRequestError(
      existente.status === EStatusProvisionamento.CONCLUIDO
        ? `O tenant "${tenant}" já foi provisionado em ${existente.atualizadoEm}.`
        : `Já existe um provisionamento em andamento para "${tenant}".`
    );
  }

  if (!existente) {
    await assertTenantLivre(tenant);
  }

  const agora = new Date().toISOString();

  const registro: IProvisionamento = {
    tenant,
    projectId,
    displayName: nomeExibido,
    locationId,
    nomeEmpresa: nomeEmpresa?.trim() || nomeExibido,
    admin: { nome: admin.nome.trim(), email: admin.email.trim().toLowerCase() },
    status: EStatusProvisionamento.EM_ANDAMENTO,
    etapaAtual: ORDEM_ETAPAS[0],
    // Uma retomada após erro preserva o que já foi feito; um início do zero
    // começa com a lista vazia.
    etapasConcluidas: existente?.etapasConcluidas ?? [],
    dados: existente?.dados ?? {},
    historico: existente?.historico ?? [],
    criadoEm: existente?.criadoEm ?? agora,
    atualizadoEm: agora,
  };

  await getReferencia(tenant).set(registro);

  return registro;
}

/// FIM - INÍCIO DO FLUXO ///

/// ETAPAS ///

interface IResultadoEtapa {
  resumo: string;
  dados?: IDadosProvisionamento;
}

type ExecutorEtapa = (
  registro: IProvisionamento,
  senhaAdmin: string
) => Promise<IResultadoEtapa>;

const executores: Record<
  Exclude<EEtapaProvisionamento, EEtapaProvisionamento.CONCLUIDO>,
  ExecutorEtapa
> = {
  async [EEtapaProvisionamento.CRIAR_PROJETO](registro) {
    const projeto = await criarProjeto({
      projectId: registro.projectId,
      displayName: registro.displayName,
      // Só existe valor aqui quando uma tentativa anterior deste mesmo
      // provisionamento já criou o projeto. É o que separa "retomar" de
      // "assumir o controle de um projeto que não é nosso".
      projectNumberEsperado: registro.dados?.projectNumber,
    });

    return {
      resumo: `Projeto ${projeto.projectId} disponível (número ${projeto.projectNumber || 'não informado'}).`,
      dados: { projectNumber: projeto.projectNumber },
    };
  },

  async [EEtapaProvisionamento.HABILITAR_APIS](registro) {
    await habilitarApis(registro.projectId);

    return {
      resumo: 'APIs do Firebase, RTDB, Identity Toolkit e IAM habilitadas.',
    };
  },

  async [EEtapaProvisionamento.ADICIONAR_FIREBASE](registro) {
    await adicionarFirebase(registro.projectId);

    return { resumo: 'Firebase adicionado ao projeto.' };
  },

  async [EEtapaProvisionamento.CRIAR_RTDB](registro) {
    const instancia = await criarInstanciaRtdb(
      registro.projectId,
      registro.locationId
    );

    return {
      // A URL real vem da API porque instâncias regionais usam o domínio
      // firebasedatabase.app, e não firebaseio.com — derivar o valor daria
      // uma URL que não resolve.
      resumo: `Realtime Database criado em ${instancia.databaseUrl}.`,
      dados: { databaseURL: instancia.databaseUrl },
    };
  },

  async [EEtapaProvisionamento.HABILITAR_AUTH](registro) {
    try {
      const habilitado = await habilitarLoginEmailSenha(registro.projectId);

      return {
        resumo: habilitado
          ? 'Provider de e-mail/senha habilitado no Authentication.'
          : 'Chamada aceita, mas o Google não confirmou o provider como habilitado — confira no console.',
      };
    } catch (erro) {
      const motivo = motivoDoErro(erro);

      // Medido na Fase 0: num projeto Spark a configuração do Identity Toolkit
      // não existe e não há API para criá-la (initializeAuth exige billing).
      // Este é o único passo do fluxo que depende do console.
      if (
        motivo === EMotivoErroGoogle.CONFIG_AUSENTE ||
        motivo === EMotivoErroGoogle.EXIGE_BILLING
      ) {
        throw acaoManualError({
          etapa: EEtapaProvisionamento.HABILITAR_AUTH,
          titulo: 'Habilite o Authentication no console do Firebase',
          motivo:
            'O Google não permite criar a configuração do Authentication por API em projetos no plano Spark.',
          url: `https://console.firebase.google.com/project/${registro.projectId}/authentication/providers`,
          instrucoes: [
            'Abra o link e clique em "Vamos começar" (ou "Get started"), se aparecer.',
            'Na lista de provedores, escolha "E-mail/senha".',
            'Ative a primeira chave (E-mail/senha) e salve.',
            'Volte aqui e clique em "Já habilitei — continuar".',
          ],
        });
      }

      throw erro;
    }
  },

  async [EEtapaProvisionamento.CRIAR_APP_WEB](registro) {
    const appId = await criarAppWeb(registro.projectId, registro.displayName);
    const config = await lerConfigAppWeb(registro.projectId, appId);

    // Se a etapa do RTDB já rodou, a URL real que guardamos é mais confiável
    // que a do config (que pode vir vazia logo após a criação).
    const configFinal: IFirebaseConfigCliente = {
      ...config,
      databaseURL: registro.dados?.databaseURL || config.databaseURL,
    };

    await saveEnvironmentConfig(registro.tenant, configFinal);

    return {
      resumo: `App Web criado e environment registrado em clientes/firebaseConfigs/${registro.tenant}.`,
      dados: { appId },
    };
  },

  async [EEtapaProvisionamento.CRIAR_SERVICE_ACCOUNT](registro) {
    const serviceAccount = await provisionarServiceAccount(registro.projectId);

    const databaseURL = registro.dados?.databaseURL;

    if (!databaseURL) {
      throw badRequestError(
        'A URL do Realtime Database ainda não é conhecida. Execute a etapa "Criar Realtime Database" antes desta.'
      );
    }

    await saveTenantServiceAccount({
      tenant: registro.tenant,
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
      databaseURL,
    });

    return {
      resumo: `Conta de serviço ${serviceAccount.client_email} emitida e tenant registrado.`,
      dados: { clientEmail: serviceAccount.client_email },
    };
  },

  async [EEtapaProvisionamento.SEMEAR_DADOS](registro, senhaAdmin) {
    if (!senhaAdmin || senhaAdmin.length < SENHA_MINIMA) {
      throw badRequestError(
        `Informe a senha do administrador do tenant (mínimo de ${SENHA_MINIMA} caracteres).`
      );
    }

    // Lê a credencial recém-gravada em clientes/serviceAccounts/{tenant} e a
    // decifra — é por isso que esta etapa vem depois da anterior: a chave
    // privada nunca precisa trafegar entre invocações.
    const contexto = await getTenantContext(registro.tenant);

    const usuario = await criarOuAtualizarAdmin(
      contexto.auth,
      registro.admin,
      senhaAdmin
    );

    const agora = new Date().toISOString();

    const semeados = await semearSeAusente(contexto.database, {
      [ETenantSeedCollection.GATEWAY_CONFIG]: {
        ativo: false,
        gateway: '',
        habilitarPixMP: false,
        realizadoOAuth: false,
      },
      [ETenantSeedCollection.NOMENCLATURA_CONFIG]: { tipoPainel: 'Alunos' },
      [ETenantSeedCollection.WHATSAPP_CONFIG]: {
        chavePix: '',
        gestor: { nome: '', whatsapp: '' },
        gupShup: false,
        nomeEmpresa: registro.nomeEmpresa,
      },
      [`${ETenantSeedCollection.DADOS_USUARIO}/${usuario.uid}`]: {
        uid: usuario.uid,
        name: registro.admin.nome,
        email: registro.admin.email,
        role: TENANT_ROLE_ADMIN,
        status: TENANT_STATUS_ATIVO,
        // Admin enxerga tudo pelo papel; a lista de permissões só é consultada
        // para os demais perfis.
        permissions: [],
        phoneNumber: '',
        createdByUserEmail: registro.admin.email,
        updatedByUserEmail: registro.admin.email,
        createdAt: agora,
        updatedAt: agora,
      },
    });

    const preservados = 4 - semeados.length;

    return {
      resumo:
        `Administrador ${registro.admin.email} criado. ` +
        `Nós semeados: ${semeados.length ? semeados.join(', ') : 'nenhum'}` +
        (preservados > 0
          ? ` (${preservados} já existiam e foram preservados).`
          : '.'),
    };
  },
};

/**
 * Grava apenas os nós que ainda não existem.
 *
 * Num projeto recém-criado todos estão ausentes, então o efeito é idêntico a
 * um update direto. A diferença aparece se esta etapa rodar contra um banco que
 * já tem dados: sobrescrever `whatsAppConfig` apagaria a chave PIX e o nome da
 * empresa do cliente, e sobrescrever `tenantConfig/gatewayConfig` derrubaria a
 * conexão com o Mercado Pago. Preservar é sempre a escolha segura — o painel
 * nunca precisa redefinir configuração que já existe.
 */
async function semearSeAusente(
  database: Database,
  valoresPorCaminho: Record<string, unknown>
): Promise<string[]> {
  const semeados: string[] = [];

  for (const [caminho, valor] of Object.entries(valoresPorCaminho)) {
    const referencia = database.ref(caminho);
    const snapshot = await referencia.once('value');

    if (snapshot.exists()) {
      continue;
    }

    await referencia.set(valor);
    semeados.push(caminho);
  }

  return semeados;
}

/**
 * Cria o primeiro admin no Authentication do tenant, ou reaproveita o usuário
 * caso a etapa já tenha rodado antes (retomada após erro).
 */
async function criarOuAtualizarAdmin(
  auth: Auth,
  admin: IAdminTenant,
  senha: string
): Promise<{ uid: string }> {
  let usuario;

  try {
    usuario = await auth.getUserByEmail(admin.email);
    await auth.updateUser(usuario.uid, {
      password: senha,
      displayName: admin.nome,
    });
  } catch (erro: any) {
    if (erro?.code !== 'auth/user-not-found') {
      throw erro;
    }

    usuario = await auth.createUser({
      email: admin.email,
      password: senha,
      displayName: admin.nome,
      emailVerified: false,
    });
  }

  // O app do tenant trata o registro em dados-usuario como fonte da verdade,
  // mas mantém as claims por paridade com o fluxo de cadastro já existente.
  await auth.setCustomUserClaims(usuario.uid, {
    role: TENANT_ROLE_ADMIN,
    status: TENANT_STATUS_ATIVO,
  });

  return { uid: usuario.uid };
}

/// FIM - ETAPAS ///

/// EXECUÇÃO ///

const proximaEtapa = (
  registro: IProvisionamento
): EEtapaProvisionamento | null =>
  ORDEM_ETAPAS.find(etapa => !registro.etapasConcluidas.includes(etapa)) ??
  null;

/**
 * Executa a próxima etapa pendente e devolve o estado atualizado.
 *
 * O frontend chama isto em sequência até status virar CONCLUIDO ou ERRO — cada
 * resposta já traz o histórico atualizado, então a timeline se preenche sozinha.
 */
export async function executarProximaEtapa(
  tenant: string,
  senhaAdmin: string
): Promise<IProvisionamento> {
  const registro = await lerProvisionamento(tenant);

  if (!registro) {
    throw notFoundError(`Não há provisionamento registrado para "${tenant}".`);
  }

  const etapa = proximaEtapa(registro);

  if (!etapa) {
    return concluir(registro);
  }

  const inicio = Date.now();

  try {
    const resultado = await executores[
      etapa as Exclude<EEtapaProvisionamento, EEtapaProvisionamento.CONCLUIDO>
    ](registro, senhaAdmin);

    const tentativas = registro.tentativasEtapaAtual ?? 0;

    const atualizado: IProvisionamento = {
      ...registro,
      status: EStatusProvisionamento.EM_ANDAMENTO,
      etapasConcluidas: [...registro.etapasConcluidas, etapa],
      dados: { ...registro.dados, ...(resultado.dados ?? {}) },
      historico: [
        ...registro.historico,
        {
          etapa,
          status: EStatusEvento.SUCESSO,
          dataHora: new Date().toISOString(),
          duracaoMs: Date.now() - inicio,
          // Quem lê a timeline depois merece saber que a etapa só passou na
          // segunda ou terceira tentativa, e por quê.
          resumo: tentativas
            ? `${resultado.resumo} (após ${tentativas + 1} tentativas, aguardando propagação)`
            : resultado.resumo,
        },
      ],
      tentativasEtapaAtual: 0,
      atualizadoEm: new Date().toISOString(),
    };

    delete atualizado.erro;
    delete atualizado.acaoManual;
    delete atualizado.aguardandoPropagacao;

    const seguinte = proximaEtapa(atualizado);

    if (!seguinte) {
      return concluir(atualizado);
    }

    atualizado.etapaAtual = seguinte;

    await getReferencia(tenant).set(atualizado);

    return atualizado;
  } catch (erro: any) {
    const mensagem = erro?.message ?? 'Erro desconhecido';
    const acaoManual = acaoManualDoErro(erro);
    const tentativas = (registro.tentativasEtapaAtual ?? 0) + 1;

    // Propagação não é falha: é "ainda não". Em vez de gastar o maxDuration da
    // função dormindo, devolvemos o controle ao frontend mantendo o status em
    // EM_ANDAMENTO — ele espera um pouco e chama de novo, e a mesma etapa é
    // reexecutada. O backoff longo acontece entre requisições, não dentro de
    // uma. Nada vai para o histórico aqui: a espera só interessa se virar erro.
    if (
      motivoDoErro(erro) === EMotivoErroGoogle.PROPAGACAO &&
      tentativas < LIMITE_TENTATIVAS_PROPAGACAO
    ) {
      const aguardando: IProvisionamento = {
        ...registro,
        status: EStatusProvisionamento.EM_ANDAMENTO,
        etapaAtual: etapa,
        tentativasEtapaAtual: tentativas,
        aguardandoPropagacao: true,
        atualizadoEm: new Date().toISOString(),
      };

      delete aguardando.erro;
      delete aguardando.acaoManual;

      console.info(
        `[provisionamento] "${registro.tenant}" etapa ${etapa}: aguardando propagação (${tentativas}/${LIMITE_TENTATIVAS_PROPAGACAO}) — ${mensagem}`
      );

      await getReferencia(tenant).set(aguardando);

      return aguardando;
    }

    const atualizado: IProvisionamento = {
      ...registro,
      // Uma ação manual não é falha: é uma pausa esperada. Distinguir os dois
      // estados é o que permite à tela pedir um clique no console em vez de
      // mostrar um erro vermelho que parece defeito.
      status: acaoManual
        ? EStatusProvisionamento.AGUARDANDO_MANUAL
        : EStatusProvisionamento.ERRO,
      etapaAtual: etapa,
      // A tentativa que falhou fica registrada junto com a que der certo
      // depois — é o que permite auditar quantas vezes uma etapa precisou ser
      // repetida e por quê.
      historico: [
        ...registro.historico,
        {
          etapa,
          status: acaoManual ? EStatusEvento.MANUAL : EStatusEvento.ERRO,
          dataHora: new Date().toISOString(),
          duracaoMs: Date.now() - inicio,
          resumo: acaoManual
            ? acaoManual.titulo
            : `Falha em "${ROTULO_ETAPAS[etapa]}".`,
          erro: mensagem,
        },
      ],
      atualizadoEm: new Date().toISOString(),
    };

    if (acaoManual) {
      atualizado.acaoManual = acaoManual;
      delete atualizado.erro;
    } else {
      atualizado.erro = mensagem;
      delete atualizado.acaoManual;
    }

    // O contador zera aqui de propósito: se a etapa parou de vez, "Tentar
    // novamente" deve ter a cota de esperas inteira outra vez.
    atualizado.tentativasEtapaAtual = 0;
    delete atualizado.aguardandoPropagacao;

    await getReferencia(tenant).set(atualizado);

    return atualizado;
  }
}

async function concluir(registro: IProvisionamento): Promise<IProvisionamento> {
  const concluido: IProvisionamento = {
    ...registro,
    status: EStatusProvisionamento.CONCLUIDO,
    etapaAtual: EEtapaProvisionamento.CONCLUIDO,
    atualizadoEm: new Date().toISOString(),
  };

  delete concluido.erro;
  delete concluido.acaoManual;
  delete concluido.aguardandoPropagacao;

  await getReferencia(registro.tenant).set(concluido);

  return concluido;
}

/// FIM - EXECUÇÃO ///
