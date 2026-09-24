export enum EBaseUrls {
  CREATE_USERS = 'create-users',
  UPDATE_USERS = 'update-users',
  UPDATE_PASSWORD_USERS = 'update-password-users',
  DELETE_USERS = 'delete-users',
  LIST_USERS = 'list-users',
  DEV_CONFIG = 'dev-config',
}

export enum EBaseUrlsAWS {
  CHECK_RECAPTCHA = 'recaptcha/check',
  /**
   * Base do CRUD de configuração de gateway (genérico, multi-provider) do srv-catra.
   * GET/PATCH/DELETE de um tenant específico anexam `/${targetTenantId}` (e `/gateway`
   * no caso do DELETE) por cima deste valor - ver APICatraService.
   * A tela de Configuração de Gateway NÃO usa isto: ela precisa opcionalmente
   * puxar a privateKey do Firebase de um tenant, que nunca pode trafegar pelo
   * browser, então passa por EDevResource.GATEWAY_CONFIG (server-to-server) em
   * vez de chamar o srv-catra diretamente daqui. Fica disponível para futuras
   * chamadas de baixa sensibilidade direto do Angular (ex: recaptcha).
   */
  GATEWAY_CONFIG_TENANT = 'gtw/config/tenant',
}

export enum EHttpVerbs {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch',
  OPTIONS = 'options',
}

export enum EHttpHeaders {
  AUTHORIZATION = 'Authorization',
  CONTENT_TYPE = 'Content-Type',
  X_TENANT_ID = 'X-Tenant-ID',
  X_API_KEY_ID = 'x-api-key',
  X_DEV_RESOURCE = 'X-Dev-Resource',
}

/**
 * Espelho de EDevResource em api/routes/dev-config.ts. Não há módulo
 * compartilhado entre o bundle do Angular e o das funções, então um recurso
 * novo precisa ser declarado nos dois lugares.
 */
export enum EDevResource {
  TENANTS = 'tenants',
  TENANT_CONNECTION = 'tenant-connection',
  ENVIRONMENTS = 'environments',
  GATEWAY_STATUS = 'gateway-status',
  GOOGLE_OAUTH = 'google-oauth',
  PROJECT_PROVISION = 'project-provision',
  ENVIRONMENT_STATUS = 'environment-status',
  GATEWAY_CONFIG = 'gateway-config',
  GATEWAY_TENANT = 'gateway-tenant',
}
