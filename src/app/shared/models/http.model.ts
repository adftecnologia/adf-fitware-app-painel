import { IFirebaseConfigCliente } from './firebase-config.model';
import { IUsuario } from './sistema.model';

export interface IHttpResponse<T = any> {
  success: boolean;
  message: string;
  error?: string;
  data: T;
}

export interface IUsuarioResponse {
  users: IUsuario[];
  total: number;
}

export interface IUsuarioCreateResponse {
  user: IUsuario;
}

export interface ITenantResumo {
  tenant: string;
  projectId: string;
  clientEmail: string;
  databaseURL: string;
  updatedAt?: string;
}

export interface ITenantsResponse {
  tenants: ITenantResumo[];
  total: number;
}

export interface ITenantResponse {
  tenant: ITenantResumo;
}

export interface ITenantTesteResponse {
  tenant: string;
  projectId?: string;
  temUsuarios?: boolean;
}

export interface IEnvironmentResumo {
  tenant: string;
  config: IFirebaseConfigCliente;
  updatedAt?: string;
}

export interface IEnvironmentsResponse {
  environments: IEnvironmentResumo[];
  total: number;
}

export interface IEnvironmentResponse {
  environment: IEnvironmentResumo;
}
