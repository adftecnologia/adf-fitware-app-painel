export enum EUsuarioPerfil {
  ADMIN = 'Admin',
  CADASTRADOR = 'Cadastrador',
  VISUALIZADOR = 'Visualizador',
}

export enum EUsuarioStatus {
  ATIVO = 'Ativo',
  INATIVO = 'Inativo',
  EXCLUIDO = 'Excluido',
}

export enum EUsuarioKeyPermission {
  USUARIOS = 'usuarios',
  TENANTS = 'tenants',
  ENVIRONMENTS = 'environments',
}
