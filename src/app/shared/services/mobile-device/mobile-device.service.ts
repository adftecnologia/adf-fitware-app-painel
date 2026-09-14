import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class MobileDeviceService {
  // Breakpoints
  private readonly MOBILE_BREAKPOINT = 768;
  private readonly TABLET_BREAKPOINT = 992;

  // Estados internos
  private isMobileSubject = new BehaviorSubject<boolean>(this.checkIsMobile());
  private isTabletSubject = new BehaviorSubject<boolean>(this.checkIsTablet());
  private screenWidthSubject = new BehaviorSubject<number>(window.innerWidth);
  private sidebarVisibleSubject = new BehaviorSubject<boolean>(false);

  // Observables públicos
  public readonly isMobile$ = this.isMobileSubject.asObservable();
  public readonly isTablet$ = this.isTabletSubject.asObservable();
  public readonly isDesktop$ = this.isMobile$.pipe(
    map(isMobile => !isMobile && window.innerWidth >= this.TABLET_BREAKPOINT)
  );
  public readonly screenWidth$ = this.screenWidthSubject.asObservable();
  public readonly sidebarVisible$ = this.sidebarVisibleSubject.asObservable();

  constructor() {
    this.initializeResizeListener();
  }

  // Getters para valores atuais
  public get isMobile(): boolean {
    return this.isMobileSubject.value;
  }

  public get isTablet(): boolean {
    return this.isTabletSubject.value;
  }

  public get isDesktop(): boolean {
    return !this.isMobile && window.innerWidth >= this.TABLET_BREAKPOINT;
  }

  public get screenWidth(): number {
    return this.screenWidthSubject.value;
  }

  public get sidebarVisible(): boolean {
    return this.sidebarVisibleSubject.value;
  }

  // Métodos públicos para controle da sidebar
  public toggleSidebar(): void {
    this.sidebarVisibleSubject.next(!this.sidebarVisible);
  }

  public setSidebarVisible(visible: boolean): void {
    this.sidebarVisibleSubject.next(visible);
  }

  public hideSidebar(): void {
    this.setSidebarVisible(false);
  }

  public showSidebar(): void {
    this.setSidebarVisible(true);
  }

  // Métodos de verificação de dispositivo
  private checkIsMobile(): boolean {
    return window.innerWidth <= this.MOBILE_BREAKPOINT;
  }

  private checkIsTablet(): boolean {
    const width = window.innerWidth;
    return width > this.MOBILE_BREAKPOINT && width <= this.TABLET_BREAKPOINT;
  }

  // Inicializa o listener de resize
  private initializeResizeListener(): void {
    fromEvent(window, 'resize')
      .pipe(
        debounceTime(50), // Debounce para performance
        map(() => window.innerWidth),
        distinctUntilChanged() // Só emite quando o valor muda
      )
      .subscribe(width => {
        this.screenWidthSubject.next(width);
        this.updateDeviceStates(width);
        this.handleResizeForSidebar();
      });
  }

  // Atualiza os estados dos dispositivos
  private updateDeviceStates(width: number): void {
    const isMobile = width <= this.MOBILE_BREAKPOINT;
    const isTablet =
      width > this.MOBILE_BREAKPOINT && width <= this.TABLET_BREAKPOINT;

    if (this.isMobileSubject.value !== isMobile) {
      this.isMobileSubject.next(isMobile);
    }

    if (this.isTabletSubject.value !== isTablet) {
      this.isTabletSubject.next(isTablet);
    }
  }

  // Lida com mudanças de resize para a sidebar
  private handleResizeForSidebar(): void {
    // Se mudou de mobile para desktop/tablet, esconde a sidebar
    if (!this.isMobile && this.sidebarVisible) {
      this.hideSidebar();
    }
  }
}
