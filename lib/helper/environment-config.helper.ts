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
  /** Presentes apenas no nó de desabilitados. */
  desabilitadoEm?: string;
  desabilitadoPor?: string;
};

export interface IEnvironmentSummary {
  tenant: string;
  config: IFirebaseConfigCliente;
  updatedAt?: string;
  /** Falso quando o tenant está no nó de desabilitados. */
  habilitado: boolean;
  desabilitadoEm?: string;
  desabilitadoPor?: string;
}

///FIM - MODELS///

export enum EEnvironmentConfigCollection {
  FIREBASE_CONFIGS = 'clientes/firebaseConfigs',
  /**
   * Tenants desabilitados.
   *
   * Desabilitar é tirar o tenant de `firebaseConfigs`, porque o app do cliente
   * lê esse nó no boot e sem ele não inicializa o Firebase. Mover em vez de
   * apagar é o que torna a ação reversível: reabilitar devolve exatamente a
   * mesma configuração, sem depender de reler nada do Google.
   */
  FIREBASE_CONFIGS_DESABILITADOS = 'clientes/firebaseConfigsDesabilitados',
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

const badRequestError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.BAD_REQUEST;
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

/** Desmonta o registro gravado (config solta na raiz) nos campos do resumo. */
const montarResumo = (
  tenant: string,
  record: IEnvironmentRecord,
  habilitado: boolean
): IEnvironmentSummary => {
  const { updatedAt, desabilitadoEm, desabilitadoPor, ...config } =
    record ?? ({} as IEnvironmentRecord);

  return {
    tenant,
    config: config as IFirebaseConfigCliente,
    updatedAt,
    habilitado,
    ...(desabilitadoEm ? { desabilitadoEm } : {}),
    ...(desabilitadoPor ? { desabilitadoPor } : {}),
  };
};

const lerNo = async (
  colecao: EEnvironmentConfigCollection
): Promise<Record<string, IEnvironmentRecord>> => {
  const snapshot = await getDatabase(getConfigApp()).ref(colecao).once('value');
  return (snapshot.val() ?? {}) as Record<string, IEnvironmentRecord>;
};

/**
 * Lista os environments, habilitados e desabilitados.
 *
 * Os dois nós entram na mesma lista de propósito: um tenant desabilitado sai
 * de `firebaseConfigs`, e se a listagem olhasse só para lá ele sumiria da tela
 * — sem caminho para reabilitar.
 */
export async function listEnvironmentConfigs(): Promise<IEnvironmentSummary[]> {
  const [habilitados, desabilitados] = await Promise.all([
    lerNo(EEnvironmentConfigCollection.FIREBASE_CONFIGS),
    lerNo(EEnvironmentConfigCollection.FIREBASE_CONFIGS_DESABILITADOS),
  ]);

  return [
    ...Object.entries(habilitados).map(([tenant, record]) =>
      montarResumo(tenant, record, true)
    ),
    ...Object.entries(desabilitados).map(([tenant, record]) =>
      montarResumo(tenant, record, false)
    ),
  ].sort((a, b) => a.tenant.localeCompare(b.tenant));
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

  return { tenant, config, updatedAt, habilitado: true };
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

  return { tenant, config, updatedAt, habilitado: true };
}

/**
 * Remove a configuração Firebase client-side de um tenant, esteja ele
 * habilitado ou desabilitado — senão um tenant desabilitado ficaria sem forma
 * de ser excluído pela interface.
 */
export async function deleteEnvironmentConfig(
  tenant: string
): Promise<IEnvironmentSummary> {
  assertValidTenantName(tenant);

  const database = getDatabase(getConfigApp());

  for (const [colecao, habilitado] of [
    [EEnvironmentConfigCollection.FIREBASE_CONFIGS, true],
    [EEnvironmentConfigCollection.FIREBASE_CONFIGS_DESABILITADOS, false],
  ] as const) {
    const referencia = database.ref(`${colecao}/${tenant}`);
    const record = (
      await referencia.once('value')
    ).val() as IEnvironmentRecord | null;

    if (record) {
      await referencia.remove();
      return montarResumo(tenant, record, habilitado);
    }
  }

  throw notFoundError(`Environment do tenant "${tenant}" não encontrado.`);
}

/// HABILITAR E DESABILITAR ///

/**
 * Move a configuração entre os nós de habilitados e desabilitados.
 *
 * O efeito prático de desabilitar: o app do cliente lê
 * `clientes/firebaseConfigs/{tenant}` no boot e, sem esse nó, não consegue
 * inicializar o Firebase — cai na tela de ambiente não encontrado. O projeto no
 * Google, a credencial do painel e os dados do tenant continuam intactos.
 */
async function moverEnvironment({
  tenant,
  habilitar,
  porEmail,
}: {
  tenant: string;
  habilitar: boolean;
  porEmail?: string;
}): Promise<IEnvironmentSummary> {
  assertValidTenantName(tenant);

  const database = getDatabase(getConfigApp());

  const origem = habilitar
    ? EEnvironmentConfigCollection.FIREBASE_CONFIGS_DESABILITADOS
    : EEnvironmentConfigCollection.FIREBASE_CONFIGS;

  const destino = habilitar
    ? EEnvironmentConfigCollection.FIREBASE_CONFIGS
    : EEnvironmentConfigCollection.FIREBASE_CONFIGS_DESABILITADOS;

  const referenciaOrigem = database.ref(`${origem}/${tenant}`);
  const record = (
    await referenciaOrigem.once('value')
  ).val() as IEnvironmentRecord | null;

  if (!record) {
    // Distingue "não existe" de "já está no estado pedido", porque a ação a
    // tomar é diferente em cada caso.
    const jaNoDestino = (
      await database.ref(`${destino}/${tenant}`).once('value')
    ).exists();

    if (jaNoDestino) {
      throw badRequestError(
        `O tenant "${tenant}" já está ${habilitar ? 'habilitado' : 'desabilitado'}.`
      );
    }

    throw notFoundError(`Environment do tenant "${tenant}" não encontrado.`);
  }

  const { desabilitadoEm, desabilitadoPor, ...resto } = record;

  const novoRecord: IEnvironmentRecord = habilitar
    ? resto
    : {
        ...resto,
        desabilitadoEm: new Date().toISOString(),
        ...(porEmail ? { desabilitadoPor: porEmail } : {}),
      };

  await database.ref(`${destino}/${tenant}`).set(novoRecord);
  await referenciaOrigem.remove();

  return montarResumo(tenant, novoRecord, habilitar);
}

export const habilitarEnvironment = (
  tenant: string
): Promise<IEnvironmentSummary> =>
  moverEnvironment({ tenant, habilitar: true });

export const desabilitarEnvironment = (
  tenant: string,
  porEmail?: string
): Promise<IEnvironmentSummary> =>
  moverEnvironment({ tenant, habilitar: false, porEmail });
