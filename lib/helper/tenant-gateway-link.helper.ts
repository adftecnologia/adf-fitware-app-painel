import { getDatabase } from 'firebase-admin/database';
import { EHttpStatusCode } from './sistema.helper';
import { getConfigApp, getTenantContext } from './tenant.helper';

/**
 * Vínculo entre um tenant do srv-catra e o config store do Fitware (o Realtime
 * Database do PRÓPRIO tenant), automatizando o passo que hoje é manual na
 * seção 6.3 do docs/mercado-pago/README.md do srv-catra.
 *
 * O srv-gesao lê esses dois nós para decidir se gera link de pagamento:
 * - `tenantConfig/gatewayConfig.ativo` é o porteiro geral;
 * - `tenantConfig/apiConfig.apiKey` + `.tenantApi` são o x-api-key/x-tenant-id
 *   que ele usa para chamar o srv-catra;
 * - `apiConfig.habilitarPixDefaultMP`/`.habilitarBoletoDefaultMP` definem a forma
 *   de pagamento padrão do aluno quando ele ainda não tem uma do Mercado Pago.
 *
 * Roda sempre server-side: a apiKey do tenant nunca passa pelo browser do painel.
 */

const API_CONFIG_PATH = 'tenantConfig/apiConfig';
const GATEWAY_CONFIG_PATH = 'tenantConfig/gatewayConfig';

/**
 * Índice reverso targetTenantId (srv-catra) -> tenant do fitmanager-util, no projeto
 * de configuração. A fonte da verdade do vínculo é o `apiConfig.tenantApi` dentro do
 * RTDB de cada tenant, mas consultá-lo exigiria abrir o banco de todos os tenants para
 * descobrir quem está ligado a um tenantId. Este índice resolve isso em uma leitura só,
 * usada para pré-selecionar o vínculo na edição e exibi-lo na listagem.
 */
const VINCULOS_PATH = 'clientes/gatewayVinculos';

/** Único provider suportado hoje - o campo existe para o app do tenant distinguir gateways. */
export const GATEWAY_MERCADO_PAGO = 'MERCADO_PAGO';

export interface IVincularTenantGatewayInput {
  /** Tenant no fitmanager-util (dono do Realtime Database que recebe a gravação). */
  firebaseTenant: string;
  /** tenantId no srv-catra - vira o `apiConfig.tenantApi`. */
  targetTenantId: string;
  /** apiKey do srv-catra - vira o `apiConfig.apiKey`. */
  apiKey: string;
  ativo: boolean;
  habilitarPix: boolean;
  habilitarBoleto: boolean;
}

export interface IVinculoResultado {
  firebaseTenant: string;
  targetTenantId: string;
  /** true quando o nó de gateway ainda não existia e foi criado agora. */
  criado: boolean;
}

const conflitoError = (message: string): Error => {
  const error: any = new Error(message);
  error.status = EHttpStatusCode.CONFLICT;
  return error;
};

/**
 * Grava apiConfig e gatewayConfig no Realtime Database do tenant.
 *
 * Regras:
 * - 1 para 1: se o tenant do Firebase já aponta para OUTRO tenant do srv-catra, recusa.
 *   Regravar o mesmo vínculo é permitido (idempotente).
 * - `realizadoOAuth` é preservado quando já existe: quem marca true é o app do tenant,
 *   depois do OAuth, e sobrescrever com false derrubaria a conexão dele com o Mercado Pago.
 * - `update` (não `set`) para não apagar campos que o app do tenant grave nesses nós e que
 *   este painel não conhece (ex: o par apiKeyDev/tenantApiDev usado em testes locais).
 */
export async function vincularTenantGateway({
  firebaseTenant,
  targetTenantId,
  apiKey,
  ativo,
  habilitarPix,
  habilitarBoleto,
}: IVincularTenantGatewayInput): Promise<IVinculoResultado> {
  const { database } = await getTenantContext(firebaseTenant);

  const apiConfigRef = database.ref(API_CONFIG_PATH);
  const gatewayConfigRef = database.ref(GATEWAY_CONFIG_PATH);

  const [apiConfigSnapshot, gatewayConfigSnapshot] = await Promise.all([
    apiConfigRef.once('value'),
    gatewayConfigRef.once('value'),
  ]);

  const apiConfigAtual = apiConfigSnapshot.val() as {
    tenantApi?: string;
  } | null;

  const vinculoExistente = apiConfigAtual?.tenantApi;

  if (vinculoExistente && vinculoExistente !== targetTenantId) {
    throw conflitoError(
      `O tenant "${firebaseTenant}" já está vinculado à configuração "${vinculoExistente}". Cada tenant aceita apenas um vínculo.`
    );
  }

  const gatewayConfigAtual = gatewayConfigSnapshot.val() as {
    realizadoOAuth?: boolean;
  } | null;

  await getDatabase(getConfigApp())
    .ref(`${VINCULOS_PATH}/${targetTenantId}`)
    .set(firebaseTenant);

  await Promise.all([
    apiConfigRef.update({
      apiKey,
      tenantApi: targetTenantId,
      habilitarPixDefaultMP: habilitarPix,
      habilitarBoletoDefaultMP: habilitarBoleto,
    }),
    gatewayConfigRef.update({
      ativo,
      gateway: GATEWAY_MERCADO_PAGO,
      realizadoOAuth: gatewayConfigAtual?.realizadoOAuth ?? false,
    }),
  ]);

  return {
    firebaseTenant,
    targetTenantId,
    criado: !gatewayConfigSnapshot.exists(),
  };
}

/**
 * Lê todos os vínculos de uma vez (o índice é um mapa pequeno, um nível só).
 * Vínculos criados antes deste índice existir não aparecem aqui: eles são
 * reindexados assim que a configuração correspondente for salva de novo.
 */
export async function listarVinculos(): Promise<Record<string, string>> {
  const snapshot = await getDatabase(getConfigApp())
    .ref(VINCULOS_PATH)
    .once('value');

  return (snapshot.val() ?? {}) as Record<string, string>;
}
