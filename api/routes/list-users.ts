import type { VercelRequest, VercelResponse } from '@vercel/node';
import SistemaHelper, {
  EFirebaseCollectionFirebase,
  EHttpMethod,
  EHttpStatusCode,
  EUserStatus,
  FirebaseHelper,
  HttpHelper,
  IUserProfile,
} from '../../lib/helper/sistema.helper';
import {
  generateErrorResponse,
  withErrorHandling,
} from '../../lib/middlewares/sistema.midd';

async function listAuthUsersHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  HttpHelper.checkHttpMethod(req, res, EHttpMethod.GET);
  SistemaHelper.validateFirebaseConfig();
  await HttpHelper.checkAuthentication(req);

  try {
    //mover isso para uma função com regra específica, permitir cadastrar apenas com email tall por exemplo.
    // await adminAuth.setCustomUserClaims('9l43p5lTiiRRepIn8JYl7lgUea32', {
    //   role: 'Admin',
    // });
    // await adminDatabaseRealtime
    //   .ref(`usuarios/9l43p5lTiiRRepIn8JYl7lgUea32`)
    //   .set({
    //     role: 'admin',
    //     permissions: [],
    //     email: 'sidaoswat@gmail.com',
    //   });

    const [usersAuthData, userFirebaseData] = await Promise.all([
      FirebaseHelper.getAllAuthUsers(true),
      FirebaseHelper.getDataFirebaseRealtime<IUserProfile[]>(
        EFirebaseCollectionFirebase.USUARIOS
      ),
    ]);

    const usersData = (usersAuthData as IUserProfile[]).map(userAuth => {
      const userFirebase = userFirebaseData.find(
        user => user.uid === userAuth.uid
      ) || {
        permissions: [],
        role: 'invalid',
        status: EUserStatus.INATIVO,
      };

      return {
        ...userAuth,
        role: userFirebase.role,
        status: userFirebase.status,
        permissions: userFirebase.permissions,
      };
    });

    res.status(EHttpStatusCode.OK).json({
      success: true,
      message: 'Lista de usuários',
      data: {
        users: usersData,
        total: usersData.length,
      },
    });
  } catch (error: any) {
    generateErrorResponse(
      res,
      error,
      'Erro ao buscar usuários do Authentication'
    );
  }
}

export default withErrorHandling(listAuthUsersHandler);
