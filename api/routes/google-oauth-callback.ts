import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  conectarComCodigo,
  EGoogleOAuthEnv,
  validarState,
} from '../../lib/helper/google-oauth.helper';
import { EHttpMethod, EHttpStatusCode } from '../../lib/helper/sistema.helper';
import { withErrorHandling } from '../../lib/middlewares/sistema.midd';

/**
 * Callback do consentimento OAuth do Google.
 *
 * Precisa ser uma função separada — e não mais um recurso dentro de
 * dev-config.ts — porque quem chega aqui é o navegador, redirecionado pelo
 * Google, sem o header Authorization que HttpHelper.checkAuthentication exige.
 *
 * A proteção equivalente é o parâmetro `state`: ele é emitido assinado
 * (HMAC-SHA256 com TENANT_SA_ENC_KEY) e com validade de 10 minutos pelo
 * endpoint autenticado que monta a URL de consentimento. Sem um state válido,
 * nada é trocado nem gravado.
 *
 * O resultado volta como redirect para a tela de Criar Projeto, porque o
 * usuário está num fluxo de navegação — devolver JSON aqui deixaria uma página
 * branca no navegador dele.
 */

/** Rota do painel para onde o usuário volta depois do consentimento. */
const ROTA_RETORNO = '/criar-projeto';

/**
 * Origem da interface do painel, quando ela não é a mesma da função.
 *
 * Em produção, app e funções vivem no mesmo domínio, então a origem da própria
 * URI de redirecionamento basta. Em desenvolvimento não: o `ng serve` sobe em
 * :4200 e o `vercel dev` em :3001, e sem isto o usuário voltaria do Google
 * para :3001, onde a interface não existe.
 */
const EPainelEnv = {
  PAINEL_BASE_URL: 'PAINEL_BASE_URL',
} as const;

function montarUrlRetorno(parametros: Record<string, string>): string {
  const redirectUri = process.env[EGoogleOAuthEnv.GOOGLE_OAUTH_REDIRECT_URI];

  if (!redirectUri) {
    throw new Error(
      `Variável de ambiente ${EGoogleOAuthEnv.GOOGLE_OAUTH_REDIRECT_URI} não configurada`
    );
  }

  const origem =
    process.env[EPainelEnv.PAINEL_BASE_URL]?.trim() ||
    new URL(redirectUri).origin;

  const url = new URL(ROTA_RETORNO, origem);

  for (const [chave, valor] of Object.entries(parametros)) {
    url.searchParams.set(chave, valor);
  }

  return url.toString();
}

async function googleOAuthCallbackHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== EHttpMethod.GET) {
    res
      .status(EHttpStatusCode.METHOD_NOT_ALLOWED)
      .json({ success: false, error: 'Método não permitido' });
    return;
  }

  const { code, state, error } = req.query as Record<
    string,
    string | undefined
  >;

  // O usuário pode simplesmente ter clicado em "Cancelar" na tela do Google.
  if (error) {
    console.info(`[google-oauth-callback] Consentimento negado: ${error}`);

    res.redirect(
      EHttpStatusCode.FOUND,
      montarUrlRetorno({
        conectado: '0',
        erro:
          error === 'access_denied'
            ? 'Autorização cancelada na tela do Google.'
            : `O Google recusou a autorização (${error}).`,
      })
    );
    return;
  }

  try {
    validarState(state);

    if (!code) {
      throw new Error('O Google não devolveu o código de autorização.');
    }

    const status = await conectarComCodigo(code);

    console.info(
      `[google-oauth-callback] Conta conectada: ${status.email || '(e-mail não informado)'}`
    );

    res.redirect(
      EHttpStatusCode.FOUND,
      montarUrlRetorno({ conectado: '1', email: status.email ?? '' })
    );
  } catch (erro: any) {
    console.error(`[google-oauth-callback] Falha: ${erro?.message}`);

    res.redirect(
      EHttpStatusCode.FOUND,
      montarUrlRetorno({
        conectado: '0',
        erro: erro?.message ?? 'Não foi possível concluir a conexão.',
      })
    );
  }
}

export default withErrorHandling(googleOAuthCallbackHandler);
