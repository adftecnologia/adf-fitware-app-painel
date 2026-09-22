import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  App,
  cert,
  deleteApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Database, getDatabase } from 'firebase-admin/database';
import { EHttpStatusCode, IAuthenticatedRequest } from './sistema.helper';

///MODELS///

export interface ITenantAuthenticatedRequest extends IAuthenticatedRequest {
  tenant?: string;
}

export interface ITenantServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKeyEnc: string;
  databaseURL: string;
  updatedAt?: string;
}

/** Contexto Firebase Admin já resolvido para um tenant específico. */
export interface ITenantContext {
  tenant: string;
  projectId: string;
  app: App;
  auth: Auth;
  database: Database;
}

export interface ITenantSummary {
  tenant: string;
  projectId: string;
  clientEmail: string;
  databaseURL: string;
  updatedAt?: string;
}

///FIM - MODELS///

/// ENUMS ///

/**
 * Variáveis de ambiente do projeto de configuração (fitmanager-util), onde
 * ficam as credenciais de todos os tenants geridos por este painel.
 * Propositalmente separadas das EFirebaseEnv do próprio painel: se estas
 * faltarem, apenas a configuração de tenants/environments falha, nunca o
 * login/cadastro de usuários do painel.
 */
export enum EConfigFirebaseEnv {
  CONFIG_FIREBASE_PROJECT_ID = 'CONFIG_FIREBASE_PROJECT_ID',
  CONFIG_FIREBASE_CLIENT_EMAIL = 'CONFIG_FIREBASE_CLIENT_EMAIL',
  CONFIG_FIREBASE_PRIVATE_KEY = 'CONFIG_FIREBASE_PRIVATE_KEY',
  CONFIG_FIREBASE_DATABASE_URL = 'CONFIG_FIREBASE_DATABASE_URL',
  TENANT_SA_ENC_KEY = 'TENANT_SA_ENC_KEY',
}

export enum EConfigCollection {
  SERVICE_ACCOUNTS = 'clientes/serviceAccounts',
  /**
   * Índice reverso projectId -> tenant, mantido pelo ponto-eletrônico para
   * descobrir a qual tenant pertence um token (cujo `aud` é o projectId).
   * Este painel é quem cria e remove tenants, então é ele quem precisa manter
   * o índice em dia.
   */
  TENANT_BY_PROJECT_ID = 'clientes/tenantByProjectId',
}

/// FIM - ENUMS ///

///CRIPTOGRAFIA///

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_BYTES = 32;
const IV_BYTES = 12;

const parseEncryptionKey = (keyBase64: string): Buffer => {
  const key = Buffer.from(keyBase64, 'base64');

  if (key.length !== ENCRYPTION_KEY_BYTES) {
    throw new Error(
      `Chave de criptografia inválida: esperados ${ENCRYPTION_KEY_BYTES} bytes em base64, recebidos ${key.length}`
    );
  }

  return key;
};

/**
 * Cifra um segredo com AES-256-GCM. O retorno tem o formato "iv:authTag:ciphertext", todos em base64.
 */
export function encryptSecret(plainText: string, keyBase64: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(
    ENCRYPTION_ALGORITHM,
    parseEncryptionKey(keyBase64),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decifra um segredo produzido por encryptSecret. O authTag do GCM garante
 * que qualquer adulteração do valor armazenado resulte em erro, e não em um
 * texto decifrado incorreto.
 */
export function decryptSecret(payload: string, keyBase64: string): string {
  const [ivBase64, authTagBase64, encryptedBase64] = payload.split(':');

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error(
      'Segredo cifrado em formato inválido. Esperado "iv:authTag:ciphertext"'
    );
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    parseEncryptionKey(keyBase64),
    Buffer.from(ivBase64, 'base64')
  );

  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

///FIM - CRIPTOGRAFIA///

///CORE///

const CONFIG_APP_NAME = 'config';

const getConfigEnvVar = (key: EConfigFirebaseEnv): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Variável de ambiente ${key} não configurada`);
  }

  return value;
};

/**
 * App Admin do projeto de configuração (fitmanager-util), usado para ler e
 * gravar as credenciais dos tenants geridos por este painel. Inicializado
 * sob demanda e reaproveitado entre invocações no mesmo container.
 */
export function getConfigApp(): App {
  const existingApp = getApps().find(app => app.name === CONFIG_APP_NAME);

  if (existingApp) {
    return existingApp;
  }

  return initializeApp(
    {
      credential: cert({
        projectId: getConfigEnvVar(
          EConfigFirebaseEnv.CONFIG_FIREBASE_PROJECT_ID
        ),
        clientEmail: getConfigEnvVar(
          EConfigFirebaseEnv.CONFIG_FIREBASE_CLIENT_EMAIL
        ),
        privateKey: getConfigEnvVar(
          EConfigFirebaseEnv.CONFIG_FIREBASE_PRIVATE_KEY
        ).replace(/\\n/g, '\n'),
      }),
      databaseURL: getConfigEnvVar(
        EConfigFirebaseEnv.CONFIG_FIREBASE_DATABASE_URL
      ),
    },
    CONFIG_APP_NAME
  );
}

/**
 * Cache de contextos por tenant. Containers serverless são reaproveitados
 * entre invocações, então o custo de inicializar o app Admin e de ler a
 * credencial no projeto de configuração é pago apenas no cold start.
 */
const tenantContextCache = new Map<string, ITenantContext>();

const notFoundError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.NOT_FOUND;
  return error;
};

/**
 * Lê o service account de um tenant no projeto de configuração e devolve a credencial já decifrada.
 */
async function loadTenantServiceAccount(tenant: string): Promise<{
  projectId: string;
  clientEmail: string;
  privateKey: string;
  databaseURL: string;
}> {
  const snapshot = await getDatabase(getConfigApp())
    .ref(`${EConfigCollection.SERVICE_ACCOUNTS}/${tenant}`)
    .once('value');

  const serviceAccount = snapshot.val() as ITenantServiceAccount | null;

  if (!serviceAccount) {
    throw notFoundError(`Tenant "${tenant}" não está provisionado.`);
  }

  const { projectId, clientEmail, privateKeyEnc, databaseURL } = serviceAccount;

  if (!projectId || !clientEmail || !privateKeyEnc || !databaseURL) {
    throw new Error(
      `Credencial do tenant "${tenant}" está incompleta no projeto de configuração.`
    );
  }

  return {
    projectId,
    clientEmail,
    databaseURL,
    privateKey: decryptSecret(
      privateKeyEnc,
      getConfigEnvVar(EConfigFirebaseEnv.TENANT_SA_ENC_KEY)
    ).replace(/\\n/g, '\n'),
  };
}

/**
 * Resolve (e cacheia) o contexto Firebase Admin de um tenant.
 * @param tenant - Identificador do tenant, como cadastrado no projeto de configuração
 */
export async function getTenantContext(
  tenant: string
): Promise<ITenantContext> {
  const cachedContext = tenantContextCache.get(tenant);

  if (cachedContext) {
    return cachedContext;
  }

  const { projectId, clientEmail, privateKey, databaseURL } =
    await loadTenantServiceAccount(tenant);

  // Um app com esse nome pode ter sobrado de uma inicialização anterior que
  // falhou antes de popular o cache. Descarta para não usar credencial velha.
  const staleApp = getApps().find(app => app.name === tenant);

  if (staleApp) {
    await deleteApp(staleApp);
  }

  const app = initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL,
    },
    tenant
  );

  const context: ITenantContext = {
    tenant,
    projectId,
    app,
    auth: getAuth(app),
    database: getDatabase(app),
  };

  tenantContextCache.set(tenant, context);

  return context;
}

/**
 * Descarta o contexto e o app Admin de um tenant.
 *
 * Necessário depois de regravar a credencial: sem isso, o container que já
 * tinha o tenant em cache continuaria usando a chave anterior até ser
 * reciclado.
 */
export async function invalidateTenantContext(tenant: string): Promise<void> {
  tenantContextCache.delete(tenant);

  const app = getApps().find(existingApp => existingApp.name === tenant);

  if (app) {
    await deleteApp(app);
  }
}

/**
 * Nomes de tenant aceitos. Além de manter o padrão de subdomínio, impede que
 * um valor com "/" ou "." desvie a escrita para outro ponto da árvore do
 * Realtime Database.
 */
const TENANT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function assertValidTenantName(tenant: string): void {
  if (!TENANT_NAME_PATTERN.test(tenant)) {
    throw new Error(
      'Nome de tenant inválido. Use apenas letras minúsculas, números e hífen (2 a 63 caracteres), começando por letra ou número.'
    );
  }
}

/** Lista os tenants provisionados. */
export async function listTenantServiceAccounts(): Promise<ITenantSummary[]> {
  const snapshot = await getDatabase(getConfigApp())
    .ref(EConfigCollection.SERVICE_ACCOUNTS)
    .once('value');

  const value = (snapshot.val() ?? {}) as Record<string, ITenantServiceAccount>;

  return Object.entries(value)
    .map(([tenant, serviceAccount]) => ({
      tenant,
      projectId: serviceAccount?.projectId ?? '',
      clientEmail: serviceAccount?.clientEmail ?? '',
      databaseURL: serviceAccount?.databaseURL ?? '',
      updatedAt: serviceAccount?.updatedAt,
    }))
    .sort((a, b) => a.tenant.localeCompare(b.tenant));
}

/**
 * Grava (ou substitui) a credencial de um tenant no projeto de configuração,
 * cifrando a chave privada.
 */
export async function saveTenantServiceAccount({
  tenant,
  projectId,
  clientEmail,
  privateKey,
  databaseURL,
}: {
  tenant: string;
  projectId: string;
  clientEmail: string;
  privateKey: string;
  databaseURL: string;
}): Promise<ITenantSummary> {
  assertValidTenantName(tenant);

  const database = getDatabase(getConfigApp());
  const referencia = database.ref(
    `${EConfigCollection.SERVICE_ACCOUNTS}/${tenant}`
  );

  // Lido antes da escrita para descobrir se o projectId mudou — trocar a
  // credencial por uma de outro projeto deixaria o índice antigo apontando
  // para um projeto que não é mais deste tenant.
  const anterior = (
    await referencia.once('value')
  ).val() as ITenantServiceAccount | null;

  const record: ITenantServiceAccount = {
    projectId,
    clientEmail,
    databaseURL,
    privateKeyEnc: encryptSecret(
      privateKey,
      getConfigEnvVar(EConfigFirebaseEnv.TENANT_SA_ENC_KEY)
    ),
    updatedAt: new Date().toISOString(),
  };

  await referencia.set(record);

  if (anterior?.projectId && anterior.projectId !== projectId) {
    await database
      .ref(`${EConfigCollection.TENANT_BY_PROJECT_ID}/${anterior.projectId}`)
      .remove();
  }

  await database
    .ref(`${EConfigCollection.TENANT_BY_PROJECT_ID}/${projectId}`)
    .set(tenant);

  await invalidateTenantContext(tenant);

  return {
    tenant,
    projectId,
    clientEmail,
    databaseURL,
    updatedAt: record.updatedAt,
  };
}

/**
 * Atualiza apenas os campos não sigilosos de um tenant já provisionado.
 *
 * Existe para que corrigir a URL do banco não obrigue a reenviar a chave
 * privada — que nunca sai do backend e, portanto, teria de ser baixada de novo
 * do Firebase Console só para uma correção trivial.
 */
export async function updateTenantDatabaseUrl(
  tenant: string,
  databaseURL: string
): Promise<ITenantSummary> {
  assertValidTenantName(tenant);

  const referencia = getDatabase(getConfigApp()).ref(
    `${EConfigCollection.SERVICE_ACCOUNTS}/${tenant}`
  );

  const snapshot = await referencia.once('value');
  const serviceAccount = snapshot.val() as ITenantServiceAccount | null;

  if (!serviceAccount) {
    throw notFoundError(`Tenant "${tenant}" não está provisionado.`);
  }

  const updatedAt = new Date().toISOString();

  await referencia.update({ databaseURL, updatedAt });
  await invalidateTenantContext(tenant);

  return {
    tenant,
    projectId: serviceAccount.projectId,
    clientEmail: serviceAccount.clientEmail,
    databaseURL,
    updatedAt,
  };
}

/**
 * Remove a credencial de um tenant.
 *
 * O aplicativo do cliente continua funcionando — ele usa a config web, não o
 * service account —, mas a gestão de usuários daquele tenant deixa de operar
 * imediatamente.
 */
export async function deleteTenantServiceAccount(
  tenant: string
): Promise<ITenantSummary> {
  assertValidTenantName(tenant);

  const database = getDatabase(getConfigApp());
  const referencia = database.ref(
    `${EConfigCollection.SERVICE_ACCOUNTS}/${tenant}`
  );

  const snapshot = await referencia.once('value');
  const serviceAccount = snapshot.val() as ITenantServiceAccount | null;

  if (!serviceAccount) {
    throw notFoundError(`Tenant "${tenant}" não está provisionado.`);
  }

  await referencia.remove();

  if (serviceAccount.projectId) {
    await database
      .ref(
        `${EConfigCollection.TENANT_BY_PROJECT_ID}/${serviceAccount.projectId}`
      )
      .remove();
  }

  await invalidateTenantContext(tenant);

  return {
    tenant,
    projectId: serviceAccount.projectId,
    clientEmail: serviceAccount.clientEmail,
    databaseURL: serviceAccount.databaseURL,
    updatedAt: serviceAccount.updatedAt,
  };
}

///FIM - CORE///

///HELPERS///

export class TenantHelper {
  /**
   * Valida que as variáveis do projeto de configuração estão presentes.
   * Separada das validações de SistemaHelper para que a ausência destas não
   * afete o login/cadastro de usuários do próprio painel.
   */
  public static validateConfigProjectEnvs(): void {
    const missingVars = Object.values(EConfigFirebaseEnv).filter(
      envVar => !process.env[envVar]
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Variáveis de ambiente do projeto de configuração não definidas: ${missingVars.join(', ')}`
      );
    }
  }
}

///FIM - HELPERS///
