import type { VercelResponse } from '@vercel/node';
import SistemaHelper, {
  EHttpMethod,
  EHttpStatusCode,
  FirebaseHelper,
  HttpHelper,
  IAuthenticatedRequest,
  ICreateUserRequest,
  IUpdateUserPassword,
} from '../helper/sistema.helper';
import {
  generateErrorResponse,
  withErrorHandling,
} from '../middlewares/sistema.midd';

async function updatePasswordUsersHandler(
  req: IAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  HttpHelper.checkHttpMethod(req, res, EHttpMethod.PATCH);
  SistemaHelper.validateFirebaseConfig();
  await HttpHelper.checkAuthentication(req);

  try {
    const userData = req.body as IUpdateUserPassword;

    SistemaHelper.isValidUserPasswordProfileData(userData);

    const userAuth = await FirebaseHelper.getAuthUserByUid(userData.uid);

    if (!userAuth) {
      throw new Error('Nenhum usuário encontrado com este UID');
    }

    const userUpdatePassword = {
      password: userData.password,
      updatedByUserEmail: req.user?.email,
    } as Partial<ICreateUserRequest>;

    let updateUserPassword;

    //atualiza senha do usuário no auth
    try {
      updateUserPassword = await FirebaseHelper.updateAuthUser(
        userData.uid,
        userUpdatePassword
      );
    } catch (error: any) {
      if (error.code === 'auth/invalid-email') {
        throw new Error('Email inválido');
      }

      if (
        ['auth/weak-password', 'auth/invalid-password'].includes(error.code)
      ) {
        throw new Error('Senha muito fraca. Use pelo menos 6 caracteres');
      }
      throw error;
    }

    res.status(EHttpStatusCode.OK).json({
      success: true,
      message: 'Senha do usuário atualizado com sucesso',
      data: {
        user: {
          uid: userData.uid,
          email: userData.email,
        },
      },
    });
  } catch (error: any) {
    generateErrorResponse(
      res,
      error,
      'Erro ao atualizar senha do usuário do Authentication'
    );
  }
}

// Exportar handler com tratamento de erro
export default withErrorHandling(updatePasswordUsersHandler);
