import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EAlertType } from '../../enums/alert.enum';
import { IAlert, IAlertConfig } from '../../models/alert.model';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private alertsSubject = new BehaviorSubject<IAlert[]>([]);
  private idCounter = 0;

  get alerts$(): Observable<IAlert[]> {
    return this.alertsSubject.asObservable();
  }

  get alerts(): IAlert[] {
    return this.alertsSubject.value;
  }

  /**
   * Exibe um alerta de sucesso
   */
  public success(
    message: string,
    title?: string,
    options?: Partial<IAlertConfig>
  ): string {
    return this.show({
      type: EAlertType.SUCCESS,
      message,
      title,
      ...{
        autoClose: true,
        dismissible: true,
        autoCloseTime: 3000,
      },
      ...options,
    });
  }

  /**
   * Exibe um alerta de informação
   */
  public info(
    message: string,
    title?: string,
    options?: Partial<IAlertConfig>
  ): string {
    return this.show({
      type: EAlertType.INFO,
      message,
      title,
      ...options,
    });
  }

  /**
   * Exibe um alerta de aviso
   */
  public warning(
    message: string,
    title?: string,
    options?: Partial<IAlertConfig>
  ): string {
    return this.show({
      type: EAlertType.WARNING,
      message,
      title,
      ...{
        autoClose: true,
        dismissible: true,
        autoCloseTime: 3000,
      },
      ...options,
    });
  }

  /**
   * Exibe um alerta de erro
   */
  public error(
    message: string,
    title?: string,
    options?: Partial<IAlertConfig>
  ): string {
    return this.show({
      type: EAlertType.DANGER,
      message,
      title: title || 'Erro',
      ...{
        autoClose: true,
        dismissible: true,
        autoCloseTime: 3000,
      },
      ...options,
    });
  }

  /**
   * Exibe um alerta personalizado
   */
  public show(config: IAlertConfig): string {
    const id = config.id || this.generateId();

    const alert: IAlert = {
      id,
      type: config.type,
      message: config.message,
      title: config.title,
      dismissible: config.dismissible ?? true,
      autoClose: config.autoClose ?? false,
      autoCloseTime: config.autoCloseTime ?? 3000,
      show: true,
    };

    const currentAlerts = this.alerts;

    // Remove alerta existente com mesmo ID se houver
    const filteredAlerts = currentAlerts.filter(a => a.id !== id);

    // Adiciona novo alerta
    this.alertsSubject.next([...filteredAlerts, alert]);

    // Auto close se configurado
    if (alert.autoClose) {
      setTimeout(() => {
        this.close(id);
      }, alert.autoCloseTime);
    }

    return id;
  }

  /**
   * Fecha um alerta específico
   */
  public close(id: string): void {
    const currentAlerts = this.alerts;
    const updatedAlerts = currentAlerts.filter(alert => alert.id !== id);
    this.alertsSubject.next(updatedAlerts);
  }

  /**
   * Fecha todos os alertas
   */
  public closeAll(): void {
    this.alertsSubject.next([]);
  }

  /**
   * Remove alertas de um tipo específico
   */
  public closeByType(type: IAlertConfig['type']): void {
    const currentAlerts = this.alerts;
    const filteredAlerts = currentAlerts.filter(alert => alert.type !== type);
    this.alertsSubject.next(filteredAlerts);
  }

  /**
   * Verifica se existe algum alerta visível
   */
  public hasAlerts(): boolean {
    return this.alerts.length > 0;
  }

  /**
   * Verifica se existe alerta de um tipo específico
   */
  public hasAlertOfType(type: IAlertConfig['type']): boolean {
    return this.alerts.some(alert => alert.type === type);
  }

  /**
   * Obtém um alerta específico por ID
   */
  public getAlert(id: string): IAlert | undefined {
    return this.alerts.find(alert => alert.id === id);
  }

  /**
   * Gera um ID único para o alerta
   */
  private generateId(): string {
    return `alert_${++this.idCounter}_${Date.now()}`;
  }
}
