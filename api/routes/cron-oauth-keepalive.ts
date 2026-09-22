import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  lerStatusConexao,
  renovarConexao,
} from '../../lib/helper/google-oauth.helper';
import { EHttpMethod, EHttpStatusCode } from '../../lib/helper/sistema.helper';
import { withErrorHandling } from '../../lib/middlewares/sistema.midd';
import { TenantHelper } from '../../lib/helper/tenant.helper';

/**
 * Cron diário que mantém viva a conexão OAuth usada para provisionar projetos.
 *
 * Por que existe: o Google expira refresh tokens que passam 6 meses sem uso, e
 * só a chamada ao endpoint de token (grant_type=refresh_token) reseta esse
 * contador — usar o access token nas APIs não conta. Se ficarmos meio ano sem
 * criar nenhum tenant, a autorização morre silenciosamente.
 *
 * O ganho secundário é o mais útil no dia a dia: se a autorização for revogada,
 * descobrimos no dia seguinte (a tela marca a conexão como EXPIRADA e pede
 * reconexão) em vez de descobrir na hora em que alguém precisa criar um tenant.
 *
 * Isto NÃO substitui publicar a tela de consentimento como "In production". No
 * modo "Testing" o Google expira o refresh token 7 dias após a emissão,
 * independentemente de uso — nenhuma renovação evita isso.
 *
 * Arquivo próprio porque a requisição vem da infraestrutura da Vercel, sem
 * usuário logado: a autenticação aqui é o CRON_SECRET, não o token do Firebase.
 */

enum ECronEnv {
  CRON_SECRET = 'CRON_SECRET',
}

async function cronOAuthKeepaliveHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== EHttpMethod.GET) {
    res
      .status(EHttpStatusCode.METHOD_NOT_ALLOWED)
      .json({ success: false, error: 'Método não permitido' });
    return;
  }

  const cronSecret = process.env[ECronEnv.CRON_SECRET];

  // Sem o segredo configurado a rota fica fechada, em vez de aberta: uma env
  // ausente não pode virar um endpoint público que consome o refresh token.
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    res
      .status(EHttpStatusCode.UNAUTHORIZED)
      .json({ success: false, error: 'Não autorizado' });
    return;
  }

  TenantHelper.validateConfigProjectEnvs();

  const statusAtual = await lerStatusConexao();

  if (!statusAtual.conectado) {
    console.info('[cron-oauth-keepalive] Nenhuma conta Google conectada.');

    res.status(EHttpStatusCode.OK).json({
      success: true,
      message: 'Nenhuma conta Google conectada — nada a renovar.',
      data: statusAtual,
    });
    return;
  }

  try {
    const status = await renovarConexao();

    console.info(
      `[cron-oauth-keepalive] Conexão renovada para ${status.email || '(e-mail não informado)'}`
    );

    res.status(EHttpStatusCode.OK).json({
      success: true,
      message: 'Conexão com o Google renovada.',
      data: status,
    });
  } catch (erro: any) {
    // renovarConexao já marcou statusConexao como EXPIRADA quando o motivo foi
    // invalid_grant. Respondemos 200 de propósito: o cron cumpriu seu papel
    // (detectar e registrar), e a Vercel não reexecuta invocações que falham.
    console.error(`[cron-oauth-keepalive] Falha ao renovar: ${erro?.message}`);

    res.status(EHttpStatusCode.OK).json({
      success: false,
      message:
        'Não foi possível renovar a conexão com o Google. Reconecte a conta no painel.',
      error: erro?.message,
      data: await lerStatusConexao(),
    });
  }
}

export default withErrorHandling(cronOAuthKeepaliveHandler);
