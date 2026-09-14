import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../auth-service/auth.service';

export interface UploadFileRequest {
  fileName: string;
  subPath: string;
  extension: string;
  base64File: string;
}

export interface UploadFileResponse {
  success: boolean;
  url?: string;
  message?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private readonly API_URL = environment.production
    ? `${(environment.srvCatra?.baseUrl || '').replace(/\/$/, '')}/s3/upload-arquivo`
    : '/s3/upload-arquivo';
  private readonly API_URL_DELETE = environment.production
    ? `${(environment.srvCatra?.baseUrl || '').replace(/\/$/, '')}/s3/deletar-arquivo`
    : '/s3/deletar-arquivo';
  private readonly TENANT_ID = environment.srvCatra?.tenantId || '';
  private readonly API_KEY = environment.srvCatra?.apiKey || '';
  private readonly pathBase = 'sousacomercio/sisgca';

  constructor(private readonly http: HttpClient, private readonly authService: AuthService) {}

  /**
   * Faz upload de um arquivo em base64 para o S3
   * @param fileName Nome do arquivo (sem extensão)
   * @param subPath Caminho no bucket (ex: "botucatu/dnaCultural/imagens")
   * @param extension Extensão do arquivo (ex: "png", "jpg", "pdf")
   * @param base64File String base64 do arquivo
   * @returns Observable com a resposta da API
   */
  uploadFile(
    fileName: string,
    subPath: string,
    extension: string,
    base64File: string
  ): Observable<UploadFileResponse> {
    const body = {
      fileName,
      subPath,
      extension,
      isPublicData: true,
      base64File,
    };

    const currentUser = this.authService.getCurrentUser;
    const tokenPromise = currentUser ? currentUser.getIdToken() : Promise.resolve('');

    return from(tokenPromise).pipe(
      switchMap((token: string) => {
        let headers = new HttpHeaders({
          'x-tenant-id': this.TENANT_ID,
          'x-api-key': this.API_KEY,
          'Content-Type': 'application/json',
        });

        if (token) {
          headers = headers.set('Authorization', `Bearer ${token}`);
        }

        return this.http.post<UploadFileResponse>(this.API_URL, body, { headers });
      })
    );
  }

  deleteFile(
    pathId: string
  ): Observable<UploadFileResponse> {
    const body = {
      pathId
    };

    const currentUser = this.authService.getCurrentUser;
    const tokenPromise = currentUser ? currentUser.getIdToken() : Promise.resolve('');

    return from(tokenPromise).pipe(
      switchMap((token: string) => {
        let headers = new HttpHeaders({
          'x-tenant-id': this.TENANT_ID,
          'x-api-key': this.API_KEY,
          'Content-Type': 'application/json'
        });

        // If token available, add standard Authorization header
        if (token) {
          headers = headers.set('Authorization', `Bearer ${token}`);
        }

        return this.http.delete<UploadFileResponse>(this.API_URL_DELETE, { headers: headers, body: body });
      })
    );
  }

  /**
   * Faz upload de imagem de perfil
   * @param userId ID do usuário
   * @param base64Image String base64 da imagem
   * @param extension Extensão da imagem (padrão: "jpg")
   * @returns Observable com a resposta da API
   */
  uploadProfileImage(
    userId: string,
    base64Image: string,
    extension: string = 'jpg'
  ): Observable<UploadFileResponse> {
    const fileName = `perfil`;
    const subPath = `${this.pathBase}/imagens/perfil/${this.authService.getCurrentUser?.uid}`;
    
    return this.uploadFile(fileName, subPath, extension, base64Image);
  }

  /**
   * Faz upload de currículo
   * @param userId ID do usuário
   * @param base64File String base64 do arquivo PDF
   * @returns Observable com a resposta da API
   */
  uploadCurriculum(
    userId: string,
    base64File: string
  ): Observable<UploadFileResponse> {
    const fileName = `curriculo`;
    const subPath = `${this.pathBase}/documentos/curriculos/${this.authService.getCurrentUser?.uid}`;
    
    return this.uploadFile(fileName, subPath, 'pdf', base64File);
  }

  /**
   * Faz upload de foto para galeria
   * @param userId ID do usuário
   * @param photoIndex Índice da foto
   * @param base64Image String base64 da imagem
   * @param extension Extensão da imagem (padrão: "jpg")
   * @returns Observable com a resposta da API
   */
  uploadGalleryPhoto(
    userId: string,
    photoIndex: number,
    base64Image: string,
    extension: string = 'jpg'
  ): Observable<UploadFileResponse> {
    const fileName = `foto-${photoIndex}`;
    const subPath = `${this.pathBase}/imagens/galeria/${this.authService.getCurrentUser?.uid}`;

    return this.uploadFile(fileName, subPath, extension, base64Image);
  }

  uploadNotaFiscal(
    fileName: string,
    base64File: string,
    extension: string = 'pdf'
  ): Observable<UploadFileResponse> {
    const normalizedName = fileName.replace(/\.[^/.]+$/, '') || 'nota-fiscal';
    const subPath = `${this.pathBase}/notas-fiscais/${this.authService.getCurrentUser?.uid}`;

    return this.uploadFile(normalizedName, subPath, extension, base64File);
  }

  deleteFileService(
    pathId: string
  ): Observable<UploadFileResponse> {

    const pontoDePartidaExtracao = 's3-storage/';
    const idx = pathId.indexOf(pontoDePartidaExtracao);
    if (idx !== -1) {
      pathId = pathId.substring(idx + pontoDePartidaExtracao.length);
    }

    return this.deleteFile(pathId);
  }

  /**
   * Remove o prefixo "data:image/..." do base64 se existir
   * @param base64String String base64 completa ou apenas os dados
   * @returns String base64 sem o prefixo
   */
  cleanBase64(base64String: string): string {
    if (base64String.includes(',')) {
      return base64String.split(',')[1];
    }
    return base64String;
  }

  /**
   * Extrai a extensão do base64 a partir do prefixo
   * @param base64String String base64 com prefixo "data:image/..."
   * @returns Extensão do arquivo (ex: "jpg", "png", "pdf")
   */
  extractExtensionFromBase64(base64String: string): string {
    const match = base64String.match(/data:([^;]+);/);
    if (match) {
      const mimeType = match[1];
      const extension = mimeType.split('/')[1];
      return extension.replace('jpeg', 'jpg');
    }
    return 'jpg'; // default
  }
}
