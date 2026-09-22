import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getDatabase } from 'firebase-admin/database';
import { EHttpStatusCode } from './sistema.helper';
import {
  decryptSecret,
  EConfigFirebaseEnv,
  encryptSecret,
  getConfigApp,
} from './tenant.helper';

/**
 * Conexão OAuth com a conta Google que provisiona os projetos dos tenants.
 *
 * Por que OAuth e não a service account do fitmanager-util: o Google não
 * permite que service accounts criem projetos fora de uma Organização do Cloud
 * ("service accounts are not allowed to create projects outside of an
 * organization resource"). Como não há Organização aqui, o painel precisa agir
 * em nome de um usuário real, com um refresh token obtido uma única vez.
 *
 * O refresh token é cifrado com o mesmo AES-256-GCM já usado nas chaves
 * privadas dos tenants (encryptSecret/decryptSecret), reaproveitando a chave
 * TENANT_SA_ENC_KEY — não há primitiva de criptografia nova neste arquivo.
 *
 * Optamos por falar com o endpoint de token via fetch em vez de usar a
 * google-auth-library: os dois fluxos necessários (authorization_code e
 * refresh_token) são triviais, e o keep-alive precisa de controle explícito
 * sobre *quando* o endpoint é chamado — a biblioteca cacheia o access token e
 * pode não chegar a bater no endpoint, que é justamente o que renova o prazo
 * de 6 meses de inatividade do refresh token.
 */

///MODELS///

/** Registro gravado em clientes/googleOAuth/provisionador. */
export interface IGoogleOAuthRecord {
  refreshTokenEnc: string;
  email: string;
  conectadoEm: string;
  statusConexao: EStatusConexaoGoogle;
  ultimaRenovacao?: string;
  ultimoErro?: string;
}

/** Versão sem segredos, segura para devolver ao frontend. */
export interface IGoogleOAuthStatus {
  conectado: boolean;
  email?: string;
  conectadoEm?: string;
  statusConexao?: EStatusConexaoGoogle;
  ultimaRenovacao?: string;
  ultimoErro?: string;
}

///FIM - MODELS///

/// ENUMS ///

export enum EGoogleOAuthEnv {
  GOOGLE_OAUTH_CLIENT_ID = 'GOOGLE_OAUTH_CLIENT_ID',
  GOOGLE_OAUTH_CLIENT_SECRET = 'GOOGLE_OAUTH_CLIENT_SECRET',
  GOOGLE_OAUTH_REDIRECT_URI = 'GOOGLE_OAUTH_REDIRECT_URI',
}

export enum EStatusConexaoGoogle {
  ATIVA = 'ATIVA',
  EXPIRADA = 'EXPIRADA',
}

export enum EGoogleOAuthCollection {
  PROVISIONADOR = 'clientes/googleOAuth/provisionador',
}

/// FIM - ENUMS ///

/// CONSTANTES ///

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * cloud-platform cobre Resource Manager, Service Usage, IAM e Identity
 * Toolkit; firebase cobre o Firebase Management API. openid/email existem só
 * para sabermos qual conta autorizou, e exibir isso no painel.
 */
const ESCOPOS = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/firebase',
  'openid',
  'email',
];

/** Janela de validade do parâmetro state do fluxo de autorização. */
const STATE_VALIDADE_MS = 10 * 60 * 1000;

/**
 * Access tokens do Google valem 1h. Guardamos por 55 min para o container
 * quente não renovar a cada etapa do provisionamento, mantendo folga para a
 * etapa mais longa não estourar com o token no limite.
 */
const ACCESS_TOKEN_TTL_MS = 55 * 60 * 1000;

/// FIM - CONSTANTES ///

/// ERROS ///

const badRequestError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.BAD_REQUEST;
  return error;
};

const naoConectadoError = (): Error => {
  const error: any = new Error(
    'Nenhuma conta Google conectada. Conecte uma conta na tela de Criar Projeto antes de provisionar.'
  );
  error.status = EHttpStatusCode.BAD_REQUEST;
  return error;
};

/// FIM - ERROS ///

/// CONFIGURAÇÃO ///

const getOAuthEnvVar = (key: EGoogleOAuthEnv): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Variável de ambiente ${key} não configurada`);
  }

  return value;
};

const getChaveCriptografia = (): string => {
  const value = process.env[EConfigFirebaseEnv.TENANT_SA_ENC_KEY];

  if (!value) {
    throw new Error(
      `Variável de ambiente ${EConfigFirebaseEnv.TENANT_SA_ENC_KEY} não configurada`
    );
  }

  return value;
};

/**
 * Valida que as variáveis do fluxo OAuth estão presentes. Separada das demais
 * para que a ausência delas quebre apenas a área de Criar Projeto, e não a
 * configuração de tenants/environments que já existe.
 */
export function validarGoogleOAuthEnvs(): void {
  const faltando = Object.values(EGoogleOAuthEnv).filter(
    envVar => !process.env[envVar]
  );

  if (faltando.length > 0) {
    throw new Error(
      `Variáveis de ambiente do OAuth do Google não definidas: ${faltando.join(', ')}`
    );
  }
}

const getReferencia = () =>
  getDatabase(getConfigApp()).ref(EGoogleOAuthCollection.PROVISIONADOR);

/// FIM - CONFIGURAÇÃO ///

/// STATE ASSINADO ///

const base64url = (valor: Buffer | string): string =>
  Buffer.from(valor)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const assinar = (payload: string): string =>
  base64url(
    createHmac('sha256', getChaveCriptografia()).update(payload).digest()
  );

/**
 * Gera um state assinado e com prazo. Sem isso, qualquer pessoa que descobrisse
 * a URL do callback poderia disparar uma troca de código no nosso backend.
 */
function gerarState(): string {
  const payload = base64url(
    JSON.stringify({
      nonce: randomBytes(16).toString('hex'),
      exp: Date.now() + STATE_VALIDADE_MS,
    })
  );

  return `${payload}.${assinar(payload)}`;
}

/** Lança se o state não foi emitido por nós ou se já venceu. */
export function validarState(state: string | undefined): void {
  if (!state) {
    throw badRequestError('Parâmetro state ausente na resposta do Google.');
  }

  const [payload, assinatura] = state.split('.');

  if (!payload || !assinatura) {
    throw badRequestError('Parâmetro state em formato inválido.');
  }

  const esperada = Buffer.from(assinar(payload));
  const recebida = Buffer.from(assinatura);

  if (
    esperada.length !== recebida.length ||
    !timingSafeEqual(esperada, recebida)
  ) {
    throw badRequestError('Parâmetro state inválido.');
  }

  let conteudo: { exp?: number };

  try {
    conteudo = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { exp?: number };
  } catch {
    throw badRequestError('Parâmetro state corrompido.');
  }

  if (!conteudo.exp || conteudo.exp < Date.now()) {
    throw badRequestError(
      'A autorização expirou. Clique em "Conectar conta Google" novamente.'
    );
  }
}

/// FIM - STATE ASSINADO ///

/// FLUXO DE AUTORIZAÇÃO ///

/** Monta a URL de consentimento do Google. */
export function gerarUrlAutorizacao(): string {
  validarGoogleOAuthEnvs();

  const parametros = new URLSearchParams({
    client_id: getOAuthEnvVar(EGoogleOAuthEnv.GOOGLE_OAUTH_CLIENT_ID),
    redirect_uri: getOAuthEnvVar(EGoogleOAuthEnv.GOOGLE_OAUTH_REDIRECT_URI),
    response_type: 'code',
    scope: ESCOPOS.join(' '),
    // offline + consent garantem que o Google devolva um refresh_token mesmo
    // quando a conta já autorizou este app antes. select_account força o
    // seletor de contas: sem ele o Google assume a conta já logada no
    // navegador, e trocar a conta de provisionamento exigiria sair do Google.
    access_type: 'offline',
    prompt: 'select_account consent',
    include_granted_scopes: 'true',
    state: gerarState(),
  });

  return `${AUTH_ENDPOINT}?${parametros.toString()}`;
}

interface IRespostaToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function chamarTokenEndpoint(
  corpo: Record<string, string>
): Promise<IRespostaToken> {
  const resposta = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(corpo),
  });

  const dados = (await resposta.json()) as IRespostaToken;

  if (!resposta.ok) {
    const erro: any = new Error(
      dados.error_description || dados.error || `HTTP ${resposta.status}`
    );
    erro.codigoOAuth = dados.error;
    throw erro;
  }

  return dados;
}

async function lerEmailDaConta(accessToken: string): Promise<string> {
  try {
    const resposta = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resposta.ok) {
      return '';
    }

    const dados = (await resposta.json()) as { email?: string };
    return dados.email ?? '';
  } catch {
    // Saber o e-mail é conveniência de UI, não requisito — uma falha aqui não
    // pode invalidar uma conexão que, no resto, funcionou.
    return '';
  }
}

/**
 * Troca o código do callback por um refresh token e grava a conexão cifrada.
 */
export async function conectarComCodigo(
  code: string
): Promise<IGoogleOAuthStatus> {
  validarGoogleOAuthEnvs();

  const tokens = await chamarTokenEndpoint({
    code,
    client_id: getOAuthEnvVar(EGoogleOAuthEnv.GOOGLE_OAUTH_CLIENT_ID),
    client_secret: getOAuthEnvVar(EGoogleOAuthEnv.GOOGLE_OAUTH_CLIENT_SECRET),
    redirect_uri: getOAuthEnvVar(EGoogleOAuthEnv.GOOGLE_OAUTH_REDIRECT_URI),
    grant_type: 'authorization_code',
  });

  if (!tokens.refresh_token) {
    throw badRequestError(
      'O Google não devolveu um refresh token. Revogue o acesso do app em myaccount.google.com/permissions e conecte novamente.'
    );
  }

  const email = tokens.access_token
    ? await lerEmailDaConta(tokens.access_token)
    : '';

  const record: IGoogleOAuthRecord = {
    refreshTokenEnc: encryptSecret(
      tokens.refresh_token,
      getChaveCriptografia()
    ),
    email,
    conectadoEm: new Date().toISOString(),
    statusConexao: EStatusConexaoGoogle.ATIVA,
  };

  await getReferencia().set(record);
  limparCacheAccessToken();

  return montarStatus(record);
}

/// FIM - FLUXO DE AUTORIZAÇÃO ///

/// CONEXÃO ///

const montarStatus = (record: IGoogleOAuthRecord | null): IGoogleOAuthStatus =>
  record
    ? {
        conectado: true,
        email: record.email,
        conectadoEm: record.conectadoEm,
        statusConexao: record.statusConexao,
        ultimaRenovacao: record.ultimaRenovacao,
        ultimoErro: record.ultimoErro,
      }
    : { conectado: false };

async function lerRecord(): Promise<IGoogleOAuthRecord | null> {
  const snapshot = await getReferencia().once('value');
  return snapshot.val() as IGoogleOAuthRecord | null;
}

/** Status da conexão, sem nenhum segredo. */
export async function lerStatusConexao(): Promise<IGoogleOAuthStatus> {
  return montarStatus(await lerRecord());
}

/** Remove a conexão. O acesso em si continua concedido do lado do Google. */
export async function desconectar(): Promise<void> {
  await getReferencia().remove();
  limparCacheAccessToken();
}

/// FIM - CONEXÃO ///

/// ACCESS TOKEN ///

let cacheAccessToken: { token: string; expiraEm: number } | null = null;

const limparCacheAccessToken = (): void => {
  cacheAccessToken = null;
};

/**
 * Chama o endpoint de token com o refresh token guardado.
 *
 * Também é o que mantém o refresh token vivo: o Google expira refresh tokens
 * não usados por 6 meses, e só esta chamada reseta esse contador — usar o
 * access token nas APIs não conta.
 */
async function renovarAccessToken(): Promise<string> {
  const record = await lerRecord();

  if (!record?.refreshTokenEnc) {
    throw naoConectadoError();
  }

  const refreshToken = decryptSecret(
    record.refreshTokenEnc,
    getChaveCriptografia()
  );

  try {
    const tokens = await chamarTokenEndpoint({
      refresh_token: refreshToken,
      client_id: getOAuthEnvVar(EGoogleOAuthEnv.GOOGLE_OAUTH_CLIENT_ID),
      client_secret: getOAuthEnvVar(EGoogleOAuthEnv.GOOGLE_OAUTH_CLIENT_SECRET),
      grant_type: 'refresh_token',
    });

    if (!tokens.access_token) {
      throw new Error('Resposta do Google sem access_token.');
    }

    await getReferencia().update({
      statusConexao: EStatusConexaoGoogle.ATIVA,
      ultimaRenovacao: new Date().toISOString(),
      ultimoErro: null,
    });

    cacheAccessToken = {
      token: tokens.access_token,
      expiraEm: Date.now() + ACCESS_TOKEN_TTL_MS,
    };

    return tokens.access_token;
  } catch (erro: any) {
    // invalid_grant significa revogado ou expirado: marcamos como EXPIRADA sem
    // apagar o registro, para a tela conseguir dizer desde quando quebrou.
    if (erro.codigoOAuth === 'invalid_grant') {
      await getReferencia().update({
        statusConexao: EStatusConexaoGoogle.EXPIRADA,
        ultimoErro: erro.message,
      });

      limparCacheAccessToken();

      throw badRequestError(
        'A autorização do Google expirou ou foi revogada. Reconecte a conta na tela de Criar Projeto.'
      );
    }

    throw erro;
  }
}

/** Access token válido, reaproveitando o do container quente quando possível. */
export async function obterAccessToken(): Promise<string> {
  if (cacheAccessToken && cacheAccessToken.expiraEm > Date.now()) {
    return cacheAccessToken.token;
  }

  return renovarAccessToken();
}

/**
 * Força uma ida ao endpoint de token, ignorando o cache. É o que o cron diário
 * executa para manter o refresh token vivo e detectar revogação cedo.
 */
export async function renovarConexao(): Promise<IGoogleOAuthStatus> {
  limparCacheAccessToken();
  await renovarAccessToken();
  return lerStatusConexao();
}

/// FIM - ACCESS TOKEN ///
