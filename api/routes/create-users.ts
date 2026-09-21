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
  IUserProfile,
} from '../../lib/helper/sistema.helper';
import {
  generateErrorResponse,
  withErrorHandling,
} from '../../lib/middlewares/sistema.midd';

async function createUsersHandler(
  req: IAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  HttpHelper.checkHttpMethod(req, res, EHttpMethod.POST);
  SistemaHelper.validateFirebaseConfig();
  await HttpHelper.checkAuthentication(req);

  try {
    const userData = req.body as ICreateUserRequest;

    SistemaHelper.isValidUserProfileData(userData);
    SistemaHelper.isValidRoleUserProfileData(userData);
    SistemaHelper.isValidStatusUserProfileData(userData);

    // const hasUserCreated = await FirebaseHelper.getAuthUserByEmail(
    //   userData.email
    // );

    // if (!!hasUserCreated) {
    //   throw new Error('Já existe um usuário cadastrado com este email');
    // }

    const userCreate = {
      email: userData.email,
      password: userData.password,
      displayName: userData.name,
      emailVerified: true,
      disabled:
        userData.status === EUserStatus.INATIVO ||
        userData.status === EUserStatus.EXCLUIDO,
      createdByUserEmail: req.user?.email,
      updatedByUserEmail: req.user?.email,
    } as Partial<ICreateUserRequest>;

    let newUser;

    //cadastra usuário no auth
    try {
      newUser = await FirebaseHelper.createAuthUser(userCreate);
      await FirebaseHelper.createCustomClaims(newUser.uid, {
        role: userData.role,
        status: userData.status,
        disabled:
          userData.status === EUserStatus.INATIVO ||
          userData.status === EUserStatus.EXCLUIDO,
      });
    } catch (error: any) {
      // Tratar erros específicos do Firebase
      if (error.code === 'auth/email-already-exists') {
        throw new Error('Já existe um usuário cadastrado com este email');
      }

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

    const dateNow = new Date().toISOString();

    const userDataRequest = {
      uid: newUser.uid,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: userData.status,
      permissions: userData.permissions,
      createdByUserEmail: req.user?.email,
      updatedByUserEmail: req.user?.email,
      createdAt: dateNow,
      updatedAt: dateNow,
    } as IUserProfile;

    //cadastra usuário no firestore realtime database
    try {
      await FirebaseHelper.createUserFirebaseRealtime(
        `${EFirebaseCollectionFirebase.USUARIOS}/${newUser.uid}`,
        userDataRequest
      );
    } catch (error: any) {
      await FirebaseHelper.deleteAuthUser(newUser.uid);
      console.info(
        'Rollback: Usuário deletado do Auth devido a falha no Realtime DB'
      );
      throw new Error('Erro ao salvar dados do usuário no banco de dados');
    }

    res.status(EHttpStatusCode.CREATED).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: userDataRequest,
      },
    });
  } catch (error: any) {
    generateErrorResponse(
      res,
      error,
      'Erro ao criar usuário do Authentication'
    );
  }
}

// Exportar handler com tratamento de erro
export default withErrorHandling(createUsersHandler);
