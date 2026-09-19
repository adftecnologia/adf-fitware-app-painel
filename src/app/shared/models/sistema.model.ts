import {
  EUsuarioKeyPermission,
  EUsuarioPerfil,
  EUsuarioStatus,
} from '../enums/sistema.enum';
import { IDefaultDate } from './date.model';

export interface IUsuarioPermission {
  key: EUsuarioKeyPermission;
  resources: string[];
}

export interface IUsuario extends IDefaultDate {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: EUsuarioPerfil;
  status: EUsuarioStatus;
  permissions: IUsuarioPermission[];
}

export interface IRoutesSistema {
  path: string;
  title: string;
  icon: string;
}
