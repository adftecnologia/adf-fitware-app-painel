import type { VercelResponse } from '@vercel/node';
import SistemaHelper, {
  EFirebaseCollectionFirebase,
  EHttpMethod,
  EHttpStatusCode,
  EUserRole,
  EUserStatus,
  FirebaseHelper,
  HttpHelper,
  IAuthenticatedRequest,
  ICreateUserRequest,
  IUserProfile,
} from '../helper/sistema.helper';
import {
  generateErrorResponse,
  withErrorHandling,
} from '../middlewares/sistema.midd';

async function updateUsersHandler(
  req: IAuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  HttpHelper.checkHttpMethod(req, res, EHttpMethod.PUT);
  SistemaHelper.validateFirebaseConfig();
  await HttpHelper.checkAuthentication(req);

  try {
    const userData = req.body as ICreateUserRequest;

    const updatePassword = userData.password !== undefined;

    SistemaHelper.isValidUserProfileData(userData, updatePassword);
    SistemaHelper.isValidUidUserProfileData(userData);
    SistemaHelper.isValidRoleUserProfileData(userData);
    SistemaHelper.isValidStatusUserProfileData(userData);

    const [hasUserByUid, hasUserByNewEmail, usersFirebase] = await Promise.all([
      FirebaseHelper.getAuthUserByUid(userData.uid),
      FirebaseHelper.getAuthUserByEmail(userData.email),
      FirebaseHelper.getDataFirebaseRealtime<IUserProfile[]>(
        EFirebaseCollectionFirebase.USUARIOS
      ),
    ]);

    if (!hasUserByUid || !usersFirebase.some(u => u.uid === userData.uid)) {
      throw new Error('Nenhum usuário encontrado com este UID');
    }

    if (!!hasUserByNewEmail && hasUserByNewEmail.uid !== userData.uid) {
      throw new Error('Já existe um usuário cadastrado com este email');
    }

    const usersAdmins = usersFirebase.filter(
      user => user.role === EUserRole.ADMIN
    );

    // Verifica se o usuário é o único admin e está tentando mudar o papel
    if (usersAdmins.length === 1 && usersAdmins[0].uid === userData.uid) {
      if (userData.role !== EUserRole.ADMIN) {
        throw new Error(
          'Não é possível alterar o papel do único usuário administrador'
        );
      }

      if (userData.status !== EUserStatus.ATIVO) {
        throw new Error(
          'Não é possível alterar o status do único usuário administrador'
        );
      }
    }

    const userUpdate = {
      email: userData.email,
      displayName: userData.name,
      emailVerified: true,
      disabled:
        userData.status === EUserStatus.INATIVO ||
        userData.status === EUserStatus.EXCLUIDO,
      createdByUserEmail: req.user?.email,
      updatedByUserEmail: req.user?.email,
      ...(updatePassword ? { password: userData.password } : {}),
    } as Partial<ICreateUserRequest>;

    let updateUser;

    //atualização do usuário no auth
    try {
      updateUser = await FirebaseHelper.updateAuthUser(
        userData.uid,
        userUpdate
      );
      await FirebaseHelper.createCustomClaims(updateUser.uid, {
        role: userData.role,
        status: userData.status,
        disabled:
          userData.status === EUserStatus.INATIVO ||
          userData.status === EUserStatus.EXCLUIDO,
      });
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

    const dateNow = new Date().toISOString();

    const userDataRequest = {
      uid: updateUser.uid,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: userData.status,
      permissions: userData.permissions,
      updatedByUserEmail: req.user?.email,
      updatedAt: dateNow,
    } as IUserProfile;

    //atualiza o usuário no firestore realtime database
    try {
      await FirebaseHelper.updateUserFirebaseRealtime(
        `${EFirebaseCollectionFirebase.USUARIOS}/${updateUser.uid}`,
        userDataRequest
      );
    } catch (error: any) {
      throw new Error('Erro ao atualizar dados do usuário no banco de dados');
    }

    res.status(EHttpStatusCode.OK).json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: {
        user: userDataRequest,
      },
    });
  } catch (error: any) {
    generateErrorResponse(
      res,
      error,
      'Erro ao atualizar usuário do Authentication'
    );
  }
}

// Exportar handler com tratamento de erro
export default withErrorHandling(updateUsersHandler);
