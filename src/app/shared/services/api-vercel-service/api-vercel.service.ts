import { DOCUMENT } from '@angular/common';
import {
  HttpClient,
  HttpContext,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, finalize, Observable, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EBaseUrls,
  EDevResource,
  EHttpHeaders,
  EHttpVerbs,
} from '../../enums/url-http.enum';
import { IFirebaseConfigCliente } from '../../models/firebase-config.model';
import { IUsuario } from '../../models/sistema.model';
import { AuthService } from '../auth-service/auth.service';
import { LoadingService } from '../loading-service/loading.service';
import {
  IEnvironmentResponse,
  IEnvironmentsResponse,
  IGatewayStatusResponse,
  IHttpResponse,
  ITenantResponse,
  ITenantsResponse,
  ITenantTesteResponse,
  IUsuarioCreateResponse,
  IUsuarioResponse,
} from './../../models/http.model';

interface IOptions<T> {
  body?: T;
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  observe?: 'body';
  params?:
    | HttpParams
    | Record<
        string,
        string | number | boolean | ReadonlyArray<string | number | boolean>
      >;
  responseType?: 'json';
  reportProgress?: boolean;
  withCredentials?: boolean;
  transferCache?:
    | {
        includeHeaders?: string[];
      }
    | boolean;
}

interface ICreateRequest<Body = unknown> {
  uri: EBaseUrls;
  method?: EHttpVerbs;
  options?: IOptions<Body>;
  disabledLoading?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ApiVercelService {
  private readonly document = inject(DOCUMENT);

  constructor(
    private readonly httpClient: HttpClient,
    private readonly authService: AuthService,
    private readonly apiLoadingService: LoadingService
  ) {}

  private generateHeaders(
    headers?: IOptions<unknown>['headers']
  ): Observable<HttpHeaders> {
    return new Observable<HttpHeaders>(observer => {
      this.authService.getCurrentUser
        ?.getIdToken()
        .then(token => {
          const httpHeaders = new HttpHeaders({
            [EHttpHeaders.CONTENT_TYPE]: 'application/json',
            [EHttpHeaders.AUTHORIZATION]: `Bearer ${token}`,
            ...headers,
          });
          observer.next(httpHeaders);
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }

  private generateUrl(url: EBaseUrls): string {
    if (environment.vercel.isLocalUrl) {
      return `${environment.vercel.baseUrl}/${url}`;
    }
    return `${this.document.location.origin}${environment.vercel.baseUrl}/${url}`;
  }

  private createRequest<Res, Body = unknown>({
    uri,
    options,
    method = EHttpVerbs.GET,
    disabledLoading = false,
  }: ICreateRequest<Body>): Observable<IHttpResponse<Res>> {
    if (!disabledLoading) {
      this.apiLoadingService.setLoadingByUrl(uri, true);
    }

    return this.generateHeaders(options?.headers || {}).pipe(
      switchMap(headers => {
        const optionsRequest = {
          ...options,
          headers,
        };

        return this.httpClient.request<IHttpResponse<Res>>(
          method,
          this.generateUrl(uri),
          optionsRequest
        );
      }),
      catchError(error => {
        if (!disabledLoading) {
          this.apiLoadingService.setLoadingByUrl(uri, false);
        }
        return throwError(() => error.error || error);
      }),
      finalize(() => {
        if (!disabledLoading) {
          this.apiLoadingService.setLoadingByUrl(uri, false);
        }
      })
    );
  }

  public getUsuarios(
    disabledLoading = false
  ): Observable<IHttpResponse<IUsuarioResponse>> {
    return this.createRequest<IUsuarioResponse>({
      disabledLoading,
      uri: EBaseUrls.LIST_USERS,
    });
  }

  public createUsuario({
    usuario,
    disabledLoading = false,
  }: {
    usuario: IUsuario;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<IUsuarioCreateResponse>> {
    return this.createRequest<IUsuarioCreateResponse>({
      disabledLoading,
      uri: EBaseUrls.CREATE_USERS,
      method: EHttpVerbs.POST,
      options: {
        body: usuario,
      },
    });
  }

  public updateUsuario({
    usuario,
    disabledLoading = false,
  }: {
    usuario: IUsuario;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<IUsuarioCreateResponse>> {
    return this.createRequest<IUsuarioCreateResponse>({
      disabledLoading,
      uri: EBaseUrls.UPDATE_USERS,
      method: EHttpVerbs.PUT,
      options: {
        body: usuario,
      },
    });
  }

  public deleteUsuario({
    uid,
    disabledLoading = false,
  }: {
    uid: string;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<IUsuarioCreateResponse>> {
    return this.createRequest<IUsuarioCreateResponse>({
      disabledLoading,
      uri: EBaseUrls.DELETE_USERS,
      method: EHttpVerbs.DELETE,
      options: {
        body: { uid },
      },
    });
  }

  /// MÓDULO DE CONFIGURAÇÃO (TENANTS) ///

  public getTenants(
    disabledLoading = false
  ): Observable<IHttpResponse<ITenantsResponse>> {
    return this.createRequest<ITenantsResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      options: {
        headers: { [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.TENANTS },
      },
    });
  }

  public provisionarTenant({
    tenant,
    serviceAccount,
    databaseURL,
    disabledLoading = false,
  }: {
    tenant: string;
    serviceAccount: string;
    databaseURL?: string;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<ITenantResponse>> {
    return this.createRequest<ITenantResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      method: EHttpVerbs.POST,
      options: {
        body: { tenant, serviceAccount, databaseURL },
        headers: { [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.TENANTS },
      },
    });
  }

  public atualizarTenant({
    tenant,
    databaseURL,
    disabledLoading = false,
  }: {
    tenant: string;
    databaseURL: string;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<ITenantResponse>> {
    return this.createRequest<ITenantResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      method: EHttpVerbs.PATCH,
      options: {
        body: { tenant, databaseURL },
        headers: { [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.TENANTS },
      },
    });
  }

  public removerTenant({
    tenant,
    disabledLoading = false,
  }: {
    tenant: string;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<ITenantResponse>> {
    return this.createRequest<ITenantResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      method: EHttpVerbs.DELETE,
      options: {
        body: { tenant },
        headers: { [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.TENANTS },
      },
    });
  }

  public testarTenant({
    tenant,
    disabledLoading = false,
  }: {
    tenant: string;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<ITenantTesteResponse>> {
    return this.createRequest<ITenantTesteResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      method: EHttpVerbs.POST,
      options: {
        body: { tenant },
        headers: {
          [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.TENANT_CONNECTION,
        },
      },
    });
  }

  /// MÓDULO DE CONFIGURAÇÃO (ENVIRONMENTS) ///

  public getEnvironments(
    disabledLoading = false
  ): Observable<IHttpResponse<IEnvironmentsResponse>> {
    return this.createRequest<IEnvironmentsResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      options: {
        headers: { [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.ENVIRONMENTS },
      },
    });
  }

  public salvarEnvironment({
    tenant,
    config,
    disabledLoading = false,
  }: {
    tenant: string;
    config: IFirebaseConfigCliente;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<IEnvironmentResponse>> {
    return this.createRequest<IEnvironmentResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      method: EHttpVerbs.POST,
      options: {
        body: { tenant, config },
        headers: { [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.ENVIRONMENTS },
      },
    });
  }

  public atualizarEnvironment({
    tenant,
    config,
    disabledLoading = false,
  }: {
    tenant: string;
    config: IFirebaseConfigCliente;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<IEnvironmentResponse>> {
    return this.createRequest<IEnvironmentResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      method: EHttpVerbs.PATCH,
      options: {
        body: { tenant, config },
        headers: { [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.ENVIRONMENTS },
      },
    });
  }

  public removerEnvironment({
    tenant,
    disabledLoading = false,
  }: {
    tenant: string;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<IEnvironmentResponse>> {
    return this.createRequest<IEnvironmentResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      method: EHttpVerbs.DELETE,
      options: {
        body: { tenant },
        headers: { [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.ENVIRONMENTS },
      },
    });
  }

  public getStatusGateway(
    disabledLoading = false
  ): Observable<IHttpResponse<IGatewayStatusResponse>> {
    return this.createRequest<IGatewayStatusResponse>({
      disabledLoading,
      uri: EBaseUrls.DEV_CONFIG,
      options: {
        headers: {
          [EHttpHeaders.X_DEV_RESOURCE]: EDevResource.GATEWAY_STATUS,
        },
      },
    });
  }
}
