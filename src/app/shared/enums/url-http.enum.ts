export enum EBaseUrls {
  CREATE_USERS = 'create-users',
  UPDATE_USERS = 'update-users',
  UPDATE_PASSWORD_USERS = 'update-password-users',
  DELETE_USERS = 'delete-users',
  LIST_USERS = 'list-users',
  DEV_CONFIG = 'dev-config',
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
  X_DEV_RESOURCE = 'X-Dev-Resource',
}

export enum EDevResource {
  TENANTS = 'tenants',
  TENANT_CONNECTION = 'tenant-connection',
  ENVIRONMENTS = 'environments',
  GATEWAY_STATUS = 'gateway-status',
}
