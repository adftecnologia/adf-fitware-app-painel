import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, finalize, Observable, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EBaseUrlsAWS,
  EHttpHeaders,
  EHttpVerbs,
} from '../../enums/url-http.enum';
import {
  ICreateTenantGatewayConfigPayload,
  IListTenantsGatewayConfigResponse,
  IOptions,
  ITenantGatewayConfig,
  IUpdateTenantGatewayConfigPayload,
} from '../../models/api-catra.model';
import { IHttpResponse } from '../../models/http.model';
import { AuthService } from '../auth-service/auth.service';
import { LoadingService } from '../loading-service/loading.service';

interface ICreateRequest<Body = unknown> {
  uri: string;
  method?: EHttpVerbs;
  options?: IOptions<Body>;
  disabledLoading?: boolean;
}

/**
 * Cliente HTTP para o srv-catra (API multitenant em AWS Lambda).
 *
 * As rotas de configuração de gateway (`gtw/config/tenant/*`) exigem autenticação em
 * 3 camadas no srv-catra: x-tenant-id/x-api-key do tenant ADMIN (não o tenant gerenciado,
 * que é passado como `targetTenantId` no path/body de cada método), um token Firebase do
 * usuário logado no painel (Authorization: Bearer) e a flag isAdmin nesse tenant - por
 * isso o tenant configurado em environment.srvCatra precisa ter isAdmin: true e o Firebase
 * Admin SDK (projectId/clientEmail/privateKey) configurados no próprio srv-catra.
 */
@Injectable({
  providedIn: 'root',
})
export class APICatraService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authService: AuthService,
    private readonly loadingService: LoadingService
  ) {}

  private generateUrl(url: string): string {
    return `${environment.srvCatra.baseUrl}/${url}`;
  }

  private generateHeaders(
    headers?: IOptions<unknown>['headers']
  ): Observable<HttpHeaders> {
    const { tenantId, apiKey } = environment.srvCatra;

    return new Observable<HttpHeaders>(observer => {
      this.authService.getCurrentUser
        ?.getIdToken()
        .then(token => {
          const httpHeaders = new HttpHeaders({
            [EHttpHeaders.CONTENT_TYPE]: 'application/json',
            [EHttpHeaders.X_TENANT_ID]: tenantId,
            [EHttpHeaders.X_API_KEY_ID]: apiKey,
            [EHttpHeaders.AUTHORIZATION]: `Bearer ${token}`,
            ...headers,
          });
          observer.next(httpHeaders);
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }

  private createRequest<Res, Body = unknown>({
    uri,
    options,
    method = EHttpVerbs.GET,
    disabledLoading = false,
  }: ICreateRequest<Body>): Observable<IHttpResponse<Res>> {
    if (!disabledLoading) {
      this.loadingService.show();
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
      catchError(error => throwError(() => error.error || error)),
      finalize(() => {
        if (!disabledLoading) {
          this.loadingService.hide();
        }
      })
    );
  }

  /// CONFIGURAÇÃO DE GATEWAY (genérico, multi-provider) ///

  public createTenantGatewayConfig({
    payload,
    disabledLoading = false,
  }: {
    payload: ICreateTenantGatewayConfigPayload;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<ITenantGatewayConfig>> {
    return this.createRequest<
      ITenantGatewayConfig,
      ICreateTenantGatewayConfigPayload
    >({
      disabledLoading,
      uri: EBaseUrlsAWS.GATEWAY_CONFIG_TENANT,
      method: EHttpVerbs.POST,
      options: { body: payload },
    });
  }

  public updateTenantGatewayConfig({
    targetTenantId,
    payload,
    disabledLoading = false,
  }: {
    targetTenantId: string;
    payload: IUpdateTenantGatewayConfigPayload;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<{ tenantId: string }>> {
    return this.createRequest<
      { tenantId: string },
      IUpdateTenantGatewayConfigPayload
    >({
      disabledLoading,
      uri: `${EBaseUrlsAWS.GATEWAY_CONFIG_TENANT}/${encodeURIComponent(targetTenantId)}`,
      method: EHttpVerbs.PATCH,
      options: { body: payload },
    });
  }

  public removeTenantGatewayConfig({
    targetTenantId,
    disabledLoading = false,
  }: {
    targetTenantId: string;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<{ tenantId: string }>> {
    return this.createRequest<{ tenantId: string }>({
      disabledLoading,
      uri: `${EBaseUrlsAWS.GATEWAY_CONFIG_TENANT}/${encodeURIComponent(targetTenantId)}/gateway`,
      method: EHttpVerbs.DELETE,
    });
  }

  public getTenantGatewayConfig({
    targetTenantId,
    disabledLoading = false,
  }: {
    targetTenantId: string;
    disabledLoading?: boolean;
  }): Observable<IHttpResponse<ITenantGatewayConfig>> {
    return this.createRequest<ITenantGatewayConfig>({
      disabledLoading,
      uri: `${EBaseUrlsAWS.GATEWAY_CONFIG_TENANT}/${encodeURIComponent(targetTenantId)}`,
    });
  }

  public listTenantsGatewayConfig({
    limit,
    nextToken,
    disabledLoading = false,
  }: {
    limit?: number;
    nextToken?: string;
    disabledLoading?: boolean;
  } = {}): Observable<IHttpResponse<IListTenantsGatewayConfigResponse>> {
    return this.createRequest<IListTenantsGatewayConfigResponse>({
      disabledLoading,
      uri: EBaseUrlsAWS.GATEWAY_CONFIG_TENANT,
      options: {
        params: {
          ...(limit !== undefined && { limit }),
          ...(nextToken && { nextToken }),
        },
      },
    });
  }
}
