import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminAuth,
  EFirebaseCollectionFirebase,
  EHttpMethod,
  EHttpStatusCode,
  EUserRole,
  EUserStatus,
  FirebaseHelper,
  IAuthenticatedRequest,
  IFirebaseEnvVars,
  IUserProfile,
} from '../helper/sistema.helper';

/**
 * Middleware para verificar token de autenticação Firebase
 * @param req - Request com possível token Bearer
 * @throws Error se token inválido ou não fornecido
 */
export async function verifyAuthToken(
  req: IAuthenticatedRequest
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader?.startsWith('Bearer ')) {
    throw new Error(
      'Token de autenticação não fornecido. Use: Authorization: Bearer <token>'
    );
  }

  const [_, token] = authHeader.split(' ') || [];

  if (!token) {
    throw new Error('Token de autenticação vazio');
  }

  try {
    const {
      user_id: uid,
      email,
      name,
      role,
      status,
    } = await adminAuth.verifyIdToken(token);

    req.user = {
      uid,
      name: name!,
      email: email!,
      role: role as EUserRole,
      status: status ?? EUserStatus.INATIVO,
    } as IAuthenticatedRequest['user'];
  } catch (error: any) {
    console.error('Erro na verificação do token:', error.message);

    if (error.code === 'auth/id-token-expired') {
      throw new Error('Token expirado. Faça login novamente');
    }

    if (error.code === 'auth/id-token-revoked') {
      throw new Error('Token revogado. Faça login novamente');
    }

    if (error.code === 'auth/invalid-id-token') {
      throw new Error('Token inválido');
    }

    throw new Error(`Erro de autenticação: ${error.message}`);
  }
}

/**
 * Middleware para verificar se o usuário tem permissões de administrador
 * @param req - Request autenticado
 * @throws Error se não for admin ou usuário inativo
 */
export async function requireAdmin(req: IAuthenticatedRequest): Promise<void> {
  if (!req.user) {
    throw new Error('Usuário não autenticado. Use verifyAuthToken primeiro');
  }

  try {
    const userData = await FirebaseHelper.getDataFirebaseRealtime<IUserProfile>(
      `${EFirebaseCollectionFirebase.USUARIOS}/${req.user.uid}`,
      true
    );

    if (!userData) {
      throw new Error('Perfil de usuário não encontrado no sistema');
    }

    if (
      !userData.role ||
      userData.role !== EUserRole.ADMIN
      // !req.user.role ||
      // req.user.role !== EUserRole.ADMIN ||
      // userData.role !== req.user.role
    ) {
      throw new Error('Acesso negado.');
    }

    if (userData.status !== EUserStatus.ATIVO) {
      throw new Error(
        'Usuário inativo ou excluído. Contate o administrador do sistema.'
      );
    }
  } catch (error: any) {
    console.error('Erro na verificação de admin:', error.message);
    throw error;
  }
}

/**
 * Middleware para validar CORS em requisições OPTIONS
 * @param req - Request
 * @param res - Response
 * @returns true se é OPTIONS e foi tratado, false caso contrário
 */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  // Configurar CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Responder a requisições OPTIONS
  if (req.method === EHttpMethod.OPTIONS) {
    res.status(EHttpStatusCode.OK).end();
    return true;
  }

  return false;
}

/**
 * Wrapper para handlers de API com tratamento de erro padrão
 * @param handler - Função handler da API
 * @returns Handler com tratamento de erro
 */
export function withErrorHandling(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // Tratar CORS
      if (handleCors(req, res)) {
        return;
      }

      await handler(req, res);
    } catch (error: any) {
      console.error('Erro na API:', error);

      // Retornar erro estruturado
      res.status(error.status || EHttpStatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.message || 'Erro interno do servidor',
        code: error.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

export function generateErrorResponse(
  res: VercelResponse,
  error: any,
  errorMessage: string,
  message: string = 'Tente novamente mais tarde'
): void {
  console.error(`${errorMessage}:`, error);
  res.status(EHttpStatusCode.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: errorMessage,
    message:
      (process.env['NODE_ENV'] as IFirebaseEnvVars['NODE_ENV']) ===
      'development'
        ? error.message
        : message,
  });
}
