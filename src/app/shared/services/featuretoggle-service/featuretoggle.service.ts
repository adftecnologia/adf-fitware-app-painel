import { Injectable } from '@angular/core';
import { ROTAS_LAYOUT } from '../../constants/layout.const';
import { ERoutes } from '../../enums/routes.enum';
import {
  EListaComTodos,
  EUsuarioKeyPermission,
  EUsuarioPerfil,
} from '../../enums/sistema.enum';
import { IRoutesSistema, IUsuario } from '../../models/sistema.model';
import { AuthService } from '../auth-service/auth.service';

@Injectable({ providedIn: 'root' })
export class FeatureToggleService {
  private usuario: IUsuario;

  constructor(private readonly authService: AuthService) {
    this.usuario = this.authService.getUserProfile as IUsuario;
  }

  get getPerfilUsuario(): IUsuario {
    return this.usuario;
  }

  get isUsuarioAdmin(): boolean {
    return this.usuario.role === EUsuarioPerfil.ADMIN;
  }

  get isUsuarioVisualizador(): boolean {
    return this.usuario.role === EUsuarioPerfil.VISUALIZADOR;
  }

  get isUsuarioCadastrador(): boolean {
    return this.usuario.role === EUsuarioPerfil.CADASTRADOR;
  }

  get isTodosFornecedores(): boolean {
    const fornecedores = this.usuario.permissions.find(
      permission => permission.key === EUsuarioKeyPermission.FORNECEDORES
    );

    if (
      fornecedores?.resources.some(
        resource => resource === EListaComTodos.TODOS
      )
    ) {
      return true;
    }
    return false;
  }

  get isTodasSecretarias(): boolean {
    const secretarias = this.usuario.permissions.find(
      permission => permission.key === EUsuarioKeyPermission.SECRETARIAS
    );

    if (
      secretarias?.resources.some(resource => resource === EListaComTodos.TODOS)
    ) {
      return true;
    }
    return false;
  }

  get idsFornecedoresVisualizador(): string[] {
    const fornecedores = this.usuario.permissions.find(
      permission => permission.key === EUsuarioKeyPermission.FORNECEDORES
    );

    if (!fornecedores) {
      return [];
    }

    return fornecedores.resources.filter(
      resource => resource !== EListaComTodos.TODOS
    );
  }

  get idsSecretariasVisualizador(): string[] {
    const secretarias = this.usuario.permissions.find(
      permission => permission.key === EUsuarioKeyPermission.SECRETARIAS
    );

    if (!secretarias) {
      return [];
    }

    return secretarias.resources.filter(
      resource => resource !== EListaComTodos.TODOS
    );
  }

  get canCadastrar(): boolean {
    return this.isUsuarioAdmin || this.isUsuarioCadastrador;
  }

  get canVisualizar(): boolean {
    return this.isUsuarioAdmin || this.isUsuarioVisualizador;
  }

  public getRotasPermitidasPorUsuario(): IRoutesSistema[] {
    let allowedRoutes: IRoutesSistema[] = ROTAS_LAYOUT;

    if (this.isUsuarioAdmin) {
      return allowedRoutes;
    }

    allowedRoutes = allowedRoutes.filter(
      route => route.path !== ERoutes.USUARIOS
    );

    if (this.isUsuarioVisualizador) {
      return allowedRoutes;
    }

    if (this.isUsuarioCadastrador) {
      return allowedRoutes.filter(
        route => ![ERoutes.DASHBOARD].includes(route.path as ERoutes)
      );
    }
    return allowedRoutes;
  }

  public hasPermissaoRotas(rota: string): boolean {
    const allowedRoutes = this.getRotasPermitidasPorUsuario();
    return allowedRoutes.some(route => route.path === rota);
  }
}
