import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EBaseUrls } from '../../enums/url-http.enum';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('Carregando...');

  private readonly appLoadingMaps = new Map<
    EBaseUrls,
    BehaviorSubject<boolean>
  >([
    [EBaseUrls.CREATE_USERS, new BehaviorSubject<boolean>(false)],
    [EBaseUrls.UPDATE_USERS, new BehaviorSubject<boolean>(false)],
    [EBaseUrls.UPDATE_PASSWORD_USERS, new BehaviorSubject<boolean>(false)],
    [EBaseUrls.DELETE_USERS, new BehaviorSubject<boolean>(false)],
    [EBaseUrls.LIST_USERS, new BehaviorSubject<boolean>(false)],
  ]);

  get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  get message$(): Observable<string> {
    return this.messageSubject.asObservable();
  }

  get messageValue(): string {
    return this.messageSubject.value;
  }

  public show(message: string = 'Carregando...'): void {
    this.messageSubject.next(message);
    this.loadingSubject.next(true);
  }

  public hide(): void {
    this.loadingSubject.next(false);
  }

  public setMessage(message: string): void {
    this.messageSubject.next(message);
  }

  private getLoadingByUrl(url: EBaseUrls): Observable<boolean> {
    return this.appLoadingMaps.get(url)!.asObservable();
  }

  private getLoadingAsValueByUrl(url: EBaseUrls): boolean {
    return this.appLoadingMaps.get(url)!.value;
  }

  public setLoadingByUrl(url: EBaseUrls, loading: boolean): void {
    if (this.appLoadingMaps.has(url)) {
      this.appLoadingMaps.get(url)!.next(loading);
    }
  }

  public getListaUsuariosLoading(
    asValue?: boolean
  ): Observable<boolean> | boolean {
    if (asValue) {
      return this.getLoadingAsValueByUrl(EBaseUrls.LIST_USERS);
    }
    return this.getLoadingByUrl(EBaseUrls.LIST_USERS);
  }

  public getCriacaoUsuarioLoading(
    asValue?: boolean
  ): Observable<boolean> | boolean {
    if (asValue) {
      return this.getLoadingAsValueByUrl(EBaseUrls.CREATE_USERS);
    }
    return this.getLoadingByUrl(EBaseUrls.CREATE_USERS);
  }

  public getAtualizacaoUsuarioLoading(
    asValue?: boolean
  ): Observable<boolean> | boolean {
    if (asValue) {
      return this.getLoadingAsValueByUrl(EBaseUrls.UPDATE_USERS);
    }
    return this.getLoadingByUrl(EBaseUrls.UPDATE_USERS);
  }

  public getAtualizacaoSenhaUsuarioLoading(
    asValue?: boolean
  ): Observable<boolean> | boolean {
    if (asValue) {
      return this.getLoadingAsValueByUrl(EBaseUrls.UPDATE_PASSWORD_USERS);
    }
    return this.getLoadingByUrl(EBaseUrls.UPDATE_PASSWORD_USERS);
  }

  public getExclusaoUsuarioLoading(
    asValue?: boolean
  ): Observable<boolean> | boolean {
    if (asValue) {
      return this.getLoadingAsValueByUrl(EBaseUrls.DELETE_USERS);
    }
    return this.getLoadingByUrl(EBaseUrls.DELETE_USERS);
  }
}
