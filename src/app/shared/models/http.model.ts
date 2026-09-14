import { IUsuario } from './sistema.model';

export interface IHttpResponse<T = any> {
  sucess: boolean;
  message: string;
  data: T;
}

export interface IUsuarioResponse {
  users: IUsuario[];
  total: number;
}

export interface IUsuarioCreateResponse {
  user: IUsuario;
}
