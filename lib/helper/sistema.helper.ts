import { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  CreateRequest,
  getAuth,
  ListUsersResult,
  UpdateRequest,
  UserRecord,
} from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdmin, verifyAuthToken } from '../middlewares/sistema.midd';

///MODELS////

// Tipos para API routes da Vercel
export interface IAuthenticatedRequest extends VercelRequest {
  user?: {
    uid: string;
    name: string;
    email: string;
    role: `${EUserRole}`;
  };
  userData?: IUserProfile;
}

export type IApiRequestType = VercelRequest;
export type IApiResponseType = VercelResponse;

export interface IUserPermission {
  key: string;
  resources: string[];
}

export interface IUserProfile {
  uid: string;
  name: string;
  email: string;
  role: EUserRole;
  status: EUserStatus;
  permissions: IUserPermission[];
  createdAt?: string;
  updatedAt?: string;
}
export interface ICreateUserRequest extends IUserProfile {
  password: string;
  createdByUserEmail: IUserProfile['email'];
  updatedByUserEmail: IUserProfile['email'];
}

export interface IUpdateUserPassword {
  uid: IUserProfile['uid'];
  email: IUserProfile['email'];
  password: ICreateUserRequest['password'];
}

export interface IDeleteUserRequest {
  uid: string;
}

export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: string;
}
export interface IFirebaseEnvVars {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_DATABASE_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
}
///FIM - MODELS////

/// ENUMS ///
export enum EFirebaseCollectionFirebase {
  USUARIOS = 'usuarios',
}

export enum EUserRole {
  ADMIN = 'Admin',
  CADASTRADOR = 'Cadastrador',
  VISUALIZADOR = 'Visualizador',
}

export enum EUserStatus {
  ATIVO = 'Ativo',
  INATIVO = 'Inativo',
  EXCLUIDO = 'Excluido',
}

export enum EFirebaseEnv {
  FIREBASE_PROJECT_ID = 'FIREBASE_PROJECT_ID',
  FIREBASE_CLIENT_EMAIL = 'FIREBASE_CLIENT_EMAIL',
  FIREBASE_PRIVATE_KEY = 'FIREBASE_PRIVATE_KEY',
  FIREBASE_DATABASE_URL = 'FIREBASE_DATABASE_URL',
  NODE_ENV = 'NODE_ENV',
}

export enum EHttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS',
}

export enum EHttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  INTERNAL_SERVER_ERROR = 500,
}

/// FIM - ENUM ///

///CORE///
const getEnvVar = (key: EFirebaseEnv): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variável de ambiente ${key} não configurada`);
  }
  return value;
};

// Inicializar Firebase Admin apenas uma vez
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: getEnvVar(EFirebaseEnv.FIREBASE_PROJECT_ID),
        clientEmail: getEnvVar(EFirebaseEnv.FIREBASE_CLIENT_EMAIL),
        privateKey: getEnvVar(EFirebaseEnv.FIREBASE_PRIVATE_KEY).replace(
          /\\n/g,
          '\n'
        ),
      }),
      databaseURL: getEnvVar(EFirebaseEnv.FIREBASE_DATABASE_URL),
    });

    // console.info('✅ Firebase Admin SDK inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin SDK:', error);
    throw error;
  }
}

// Exportar serviços do Firebase Admin
export const adminAuth = getAuth();
export const adminDatabaseRealtime = getDatabase();
export const adminFirestore = getFirestore();
///FIM - CORE///

///HELPERS///
export default class SistemaHelper {
  public static validateFirebaseConfig(): void {
    const requiredEnvVars: Partial<keyof IFirebaseEnvVars>[] = Object.keys(
      EFirebaseEnv
    ).map(key => EFirebaseEnv[key as keyof typeof EFirebaseEnv]);

    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingVars.length > 0) {
      throw new Error(
        `Variáveis de ambiente Firebase não configuradas: ${missingVars.join(', ')}`
      );
    }
  }

  public static isValidUserProfileData(
    userData: ICreateUserRequest,
    validatedPassword: boolean = true
  ): void {
    if (!userData) {
      throw new Error('Dados de usuário é obrigatório');
    }

    if (
      !userData.name ||
      !userData.email ||
      !userData.role ||
      !userData.status ||
      !userData.permissions ||
      (validatedPassword && !userData.password)
    ) {
      throw new Error(
        `Dados de usuário é obrigatório. Campos obrigatórios: nome, email, role, status, permissions${validatedPassword ? ' e password' : ''}`
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(userData.email)) {
      throw new Error('Formato de email inválido');
    }

    if (validatedPassword && userData.password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres');
    }
  }

  public static isValidRoleUserProfileData({ role }: ICreateUserRequest): void {
    if (!role || !Object.values(EUserRole).includes(role as EUserRole)) {
      throw new Error(
        `Tipo de perfil para usuário é inválida. Formatos válidos: ${Object.values(EUserRole).join(', ')}`
      );
    }
  }

  public static isValidStatusUserProfileData({
    status,
  }: ICreateUserRequest): void {
    if (
      !status ||
      !Object.values(EUserStatus).includes(status as EUserStatus)
    ) {
      throw new Error(
        `Tipo de status para usuário é inválida. Formatos válidos: ${Object.values(EUserStatus).join(', ')}`
      );
    }
  }

  public static isValidUidUserProfileData({
    uid,
  }: ICreateUserRequest | IDeleteUserRequest): void {
    if (!uid) {
      throw new Error('UID do usuário é obrigatório');
    }
  }

  public static isValidUserPasswordProfileData({
    uid,
    email,
    password,
  }: IUpdateUserPassword): void {
    if (!uid) {
      throw new Error('UID do usuário é obrigatório');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      throw new Error('Formato de email inválido');
    }

    if (!password || password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres');
    }
  }
}

export class HttpHelper {
  public static checkHttpMethod(
    req: VercelRequest,
    res: VercelResponse,
    allowedMethod: EHttpMethod
  ): VercelResponse | void {
    if (req.method !== allowedMethod) {
      res.status(EHttpStatusCode.METHOD_NOT_ALLOWED).json({
        success: false,
        error: 'Método não permitido',
        allowedMethods: [allowedMethod],
      });
      return;
    }
  }

  public static async checkAuthentication(
    req: IAuthenticatedRequest
  ): Promise<void> {
    await verifyAuthToken(req);
    await requireAdmin(req);
  }
}

export class FirebaseHelper {
  private static convertUserRecordToIUserProfile({
    uid,
    email,
    displayName: name,
    // disabled,
    customClaims,
  }: UserRecord): IUserProfile {
    return {
      uid,
      email: email!,
      name: name!,
      status: customClaims?.['status'] || EUserStatus.INATIVO,
      role: customClaims?.['role'] || 'invalid',
      permissions: [],
    };
  }

  public static async getDataFirebaseRealtime<T = any>(
    collection: EFirebaseCollectionFirebase | string,
    getById: boolean = false
  ): Promise<T> {
    const snapshot = await adminDatabaseRealtime.ref(collection).once('value');
    if (getById) {
      return (snapshot.val() || {}) as T;
    }

    const result: T[] = snapshot.val()
      ? Object.keys(snapshot.val()).map(key => ({
          id: key,
          ...snapshot.val()[key],
        }))
      : [];

    return result.sort((a, b) =>
      (a as any).nome?.localeCompare((b as any)?.nome)
    ) as T;
  }

  public static async getAllAuthUsers(
    returnConvertedData = false,
    maxResult?: number
  ): Promise<ListUsersResult | IUserProfile[]> {
    const result = await adminAuth.listUsers(maxResult);

    if (returnConvertedData) {
      return result.users.map(
        this.convertUserRecordToIUserProfile
      ) as IUserProfile[];
    }
    return result;
  }

  public static async getAuthUserByEmail(
    email: IUserProfile['email']
  ): Promise<IUserProfile | null> {
    try {
      const user: UserRecord = await adminAuth.getUserByEmail(email);
      return this.convertUserRecordToIUserProfile(user);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return null;
      } else {
        throw error;
      }
    }
  }

  public static async getAuthUserByUid(
    uid: IUserProfile['uid']
  ): Promise<IUserProfile | null> {
    try {
      const user: UserRecord = await adminAuth.getUser(uid);
      return this.convertUserRecordToIUserProfile(user);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return null;
      } else {
        throw error;
      }
    }
  }

  public static async createAuthUser(
    user: CreateRequest
  ): Promise<IUserProfile> {
    const newUser = await adminAuth.createUser(user);
    return this.convertUserRecordToIUserProfile(newUser);
  }

  public static async updateAuthUser(
    userUid: string,
    user: UpdateRequest
  ): Promise<IUserProfile> {
    const updatedUser = await adminAuth.updateUser(userUid, user);
    return this.convertUserRecordToIUserProfile(updatedUser);
  }

  public static async createUserFirebaseRealtime(
    collection: EFirebaseCollectionFirebase | string,
    user: IUserProfile
  ): Promise<void> {
    return adminDatabaseRealtime.ref(collection).set(user);
  }

  public static async updateUserFirebaseRealtime(
    collection: EFirebaseCollectionFirebase | string,
    user: Partial<IUserProfile>
  ): Promise<void> {
    return adminDatabaseRealtime.ref(collection).update(user);
  }

  public static async deleteAuthUser(
    userId: IUserProfile['uid']
  ): Promise<void> {
    return adminAuth.deleteUser(userId);
  }

  public static async createCustomClaims(
    userId: IUserProfile['uid'],
    data: any
  ): Promise<void> {
    return await adminAuth.setCustomUserClaims(userId, data);
  }
}
