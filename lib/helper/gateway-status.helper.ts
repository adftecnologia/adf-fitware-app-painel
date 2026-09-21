import { getTenantContext, listTenantServiceAccounts } from './tenant.helper';

///MODELS///

/**
 * Nó tenantConfig/gatewayConfig, gravado por cada aplicativo de tenant no
 * próprio Realtime Database dele — este painel só lê, nunca escreve aqui.
 */
export interface IGatewayConfig {
  ativo?: boolean;
  gateway?: string;
  habilitarPixMP?: boolean;
  realizadoOAuth?: boolean;
}

export interface IGatewayStatusSummary {
  total: number;
  configurados: number;
}

///FIM - MODELS///

const GATEWAY_CONFIG_PATH = 'tenantConfig/gatewayConfig';
const GATEWAY_MERCADO_PAGO = 'MERCADO_PAGO';

/**
 * Verifica se um tenant tem o Mercado Pago ativo, consultando o Realtime
 * Database do PRÓPRIO tenant (não o fitmanager-util). Falha de conexão com
 * um tenant específico (credencial inválida, projeto fora do ar) não deve
 * derrubar a apuração dos demais — conta como não configurado e loga o erro.
 */
async function temMercadoPagoAtivo(tenant: string): Promise<boolean> {
  try {
    const context = await getTenantContext(tenant);
    const snapshot = await context.database
      .ref(GATEWAY_CONFIG_PATH)
      .once('value');

    const config = snapshot.val() as IGatewayConfig | null;

    return !!config?.ativo && config?.gateway === GATEWAY_MERCADO_PAGO;
  } catch (error: any) {
    console.error(
      `[gateway-status] Falha ao consultar tenant "${tenant}": ${error.message}`
    );
    return false;
  }
}

/** Apura, entre os tenants provisionados, quantos têm o Mercado Pago ativo. */
export async function getGatewayStatusSummary(): Promise<IGatewayStatusSummary> {
  const tenants = await listTenantServiceAccounts();

  const resultados = await Promise.all(
    tenants.map(({ tenant }) => temMercadoPagoAtivo(tenant))
  );

  return {
    total: tenants.length,
    configurados: resultados.filter(Boolean).length,
  };
}
