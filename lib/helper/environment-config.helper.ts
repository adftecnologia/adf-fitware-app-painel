import { getDatabase } from 'firebase-admin/database';
import { EHttpStatusCode } from './sistema.helper';
import { assertValidTenantName, getConfigApp } from './tenant.helper';

///MODELS///

export interface IFirebaseConfigCliente {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * Formato gravado em clientes/firebaseConfigs/{tenant} no Realtime Database:
 * os campos do FirebaseConfig soltos na raiz do nó (sem wrapper), pois é
 * exatamente o objeto que o bootstrap do app do tenant lê e passa direto pra
 * initializeApp(). O `updatedAt` é um campo irmão adicional só deste painel —
 * o Firebase SDK ignora chaves que não reconhece.
 */
export type IEnvironmentRecord = IFirebaseConfigCliente & {
  updatedAt?: string;
};

export interface IEnvironmentSummary {
  tenant: string;
  config: IFirebaseConfigCliente;
  updatedAt?: string;
}

///FIM - MODELS///

export enum EEnvironmentConfigCollection {
  FIREBASE_CONFIGS = 'clientes/firebaseConfigs',
}

const REQUIRED_CONFIG_FIELDS: (keyof IFirebaseConfigCliente)[] = [
  'apiKey',
  'authDomain',
  'databaseURL',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const notFoundError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.NOT_FOUND;
  return error;
};

/**
 * Valida os campos obrigatórios da configuração Firebase client-side. Esta
 * configuração não é sigilosa (é a mesma que o app do tenant expõe no
 * navegador), então, diferente do service account, é gravada sem cifra.
 */
export function assertValidFirebaseConfigCliente(
  config: unknown
): asserts config is IFirebaseConfigCliente {
  if (!config || typeof config !== 'object') {
    throw new Error('Informe a configuração Firebase do tenant.');
  }

  const missingFields = REQUIRED_CONFIG_FIELDS.filter(
    field => !(config as Record<string, unknown>)[field]
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Configuração Firebase incompleta. Campos obrigatórios ausentes: ${missingFields.join(', ')}`
    );
  }
}

/** Lista os environments (configurações Firebase client-side) provisionados. */
export async function listEnvironmentConfigs(): Promise<IEnvironmentSummary[]> {
  const snapshot = await getDatabase(getConfigApp())
    .ref(EEnvironmentConfigCollection.FIREBASE_CONFIGS)
    .once('value');

  const value = (snapshot.val() ?? {}) as Record<string, IEnvironmentRecord>;

  return Object.entries(value)
    .map(([tenant, record]) => {
      const { updatedAt, ...config } = record ?? ({} as IEnvironmentRecord);
      return {
        tenant,
        config: config as IFirebaseConfigCliente,
        updatedAt,
      };
    })
    .sort((a, b) => a.tenant.localeCompare(b.tenant));
}

/** Grava (ou substitui) a configuração Firebase client-side de um tenant. */
export async function saveEnvironmentConfig(
  tenant: string,
  config: IFirebaseConfigCliente
): Promise<IEnvironmentSummary> {
  assertValidTenantName(tenant);
  assertValidFirebaseConfigCliente(config);

  const updatedAt = new Date().toISOString();
  const record: IEnvironmentRecord = { ...config, updatedAt };

  await getDatabase(getConfigApp())
    .ref(`${EEnvironmentConfigCollection.FIREBASE_CONFIGS}/${tenant}`)
    .set(record);

  return { tenant, config, updatedAt };
}

/** Atualiza a configuração Firebase client-side de um tenant já provisionado. */
export async function updateEnvironmentConfig(
  tenant: string,
  config: IFirebaseConfigCliente
): Promise<IEnvironmentSummary> {
  assertValidTenantName(tenant);
  assertValidFirebaseConfigCliente(config);

  const referencia = getDatabase(getConfigApp()).ref(
    `${EEnvironmentConfigCollection.FIREBASE_CONFIGS}/${tenant}`
  );

  const snapshot = await referencia.once('value');

  if (!snapshot.val()) {
    throw notFoundError(`Environment do tenant "${tenant}" não encontrado.`);
  }

  const updatedAt = new Date().toISOString();
  const record: IEnvironmentRecord = { ...config, updatedAt };

  // set (não update) para substituir por completo o nó: evita deixar campos
  // antigos que não fazem mais parte do config atual.
  await referencia.set(record);

  return { tenant, config, updatedAt };
}

/** Remove a configuração Firebase client-side de um tenant. */
export async function deleteEnvironmentConfig(
  tenant: string
): Promise<IEnvironmentSummary> {
  assertValidTenantName(tenant);

  const referencia = getDatabase(getConfigApp()).ref(
    `${EEnvironmentConfigCollection.FIREBASE_CONFIGS}/${tenant}`
  );

  const snapshot = await referencia.once('value');
  const record = snapshot.val() as IEnvironmentRecord | null;

  if (!record) {
    throw notFoundError(`Environment do tenant "${tenant}" não encontrado.`);
  }

  await referencia.remove();

  const { updatedAt, ...config } = record;

  return { tenant, config: config as IFirebaseConfigCliente, updatedAt };
}
