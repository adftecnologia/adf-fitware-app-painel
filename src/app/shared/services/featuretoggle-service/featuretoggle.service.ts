import { Injectable } from '@angular/core';
import { ROTAS_LAYOUT } from '../../constants/layout.const';
import { ERoutes } from '../../enums/routes.enum';
import { EUsuarioPerfil } from '../../enums/sistema.enum';
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

  public getRotasPermitidasPorUsuario(): IRoutesSistema[] {
    if (this.isUsuarioAdmin) {
      return ROTAS_LAYOUT;
    }
    return ROTAS_LAYOUT.filter(route => route.path === ERoutes.PERFIL_USUARIO);
  }

  public hasPermissaoRotas(rota: string): boolean {
    const allowedRoutes = this.getRotasPermitidasPorUsuario();
    return allowedRoutes.some(route => route.path === rota);
  }
}
