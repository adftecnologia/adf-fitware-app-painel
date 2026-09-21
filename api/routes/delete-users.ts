import type { VercelResponse } from '@vercel/node';
import SistemaHelper, {
  EFirebaseCollectionFirebase,
  EHttpMethod,
  EHttpStatusCode,
  EUserStatus,
  FirebaseHelper,
  HttpHelper,
  IAuthenticatedRequest,
  ICreateUserRequest,
  IDeleteUserRequest,
  IUserProfile,
} from '../../lib/helper/sistema.helper';
import {
  generateErrorResponse,
  withErrorHandling,
} from '../../lib/middlewares/sistema.midd';

async function deleteUsersHandler(
  req: IAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  HttpHelper.checkHttpMethod(req, res, EHttpMethod.DELETE);
  SistemaHelper.validateFirebaseConfig();
  await HttpHelper.checkAuthentication(req);

  try {
    const userData = req.body as IDeleteUserRequest;

    SistemaHelper.isValidUidUserProfileData(userData);

    if (userData.uid === req.user!.uid) {
      throw new Error('Usuário não pode excluir ele mesmo');
    }

    const [hasUserByUid, hasUserByUidFirebase] = await Promise.all([
      FirebaseHelper.getAuthUserByUid(userData.uid),
      FirebaseHelper.getDataFirebaseRealtime<IUserProfile>(
        `${EFirebaseCollectionFirebase.USUARIOS}/${userData.uid}`,
        true
      ),
    ]);

    if (!hasUserByUid || !hasUserByUidFirebase) {
      throw new Error('Nenhum usuário encontrado com este UID');
    }

    if (hasUserByUidFirebase.status === EUserStatus.EXCLUIDO) {
      throw new Error('Usuário já está excluído');
    }

    const userUpdate = {
      disabled: true,
      updatedByUserEmail: req.user?.email,
    } as Partial<ICreateUserRequest>;

    let updateUser;

    //atualização do usuário no auth
    try {
      updateUser = await FirebaseHelper.updateAuthUser(
        userData.uid,
        userUpdate
      );
    } catch (error: any) {
      if (error.code === 'auth/invalid-email') {
        throw new Error('Email inválido');
      }
      throw error;
    }

    const dateNow = new Date().toISOString();

    const userDataRequest = {
      status: EUserStatus.EXCLUIDO,
      updatedByUserEmail: req.user?.email,
      updatedAt: dateNow,
    } as Partial<IUserProfile>;

    //atualiza o usuário no firestore realtime database
    try {
      await FirebaseHelper.updateUserFirebaseRealtime(
        `${EFirebaseCollectionFirebase.USUARIOS}/${updateUser.uid}`,
        userDataRequest
      );
    } catch (error: any) {
      throw new Error('Erro ao excluir dados do usuário no banco de dados');
    }

    res.status(EHttpStatusCode.OK).json({
      success: true,
      message: 'Usuário excluído com sucesso',
      data: {
        user: userDataRequest,
      },
    });
  } catch (error: any) {
    generateErrorResponse(
      res,
      error,
      'Erro ao excluir usuário do Authentication'
    );
  }
}

// Exportar handler com tratamento de erro
export default withErrorHandling(deleteUsersHandler);
