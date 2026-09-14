import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ALERT_ICONS } from '../../constants/layout.const';

export type AlertType = 'success' | 'info' | 'warning' | 'danger';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.css',
})
export class AlertComponent {
  @Input() public type: AlertType = 'info';
  @Input() public title: string = '';
  @Input() public message: string = '';
  @Input() public dismissible: boolean = true;
  @Input() public show: boolean = true;
  @Input() public autoClose: boolean = false;
  @Input() public autoCloseTime: number = 3000; // 3 segundos por padrão

  @Output() public onClose = new EventEmitter<void>();

  private autoCloseTimer?: number;

  public ngOnInit(): void {
    if (this.autoClose && this.show) {
      this.startAutoCloseTimer();
    }
  }

  public ngOnDestroy(): void {
    this.clearAutoCloseTimer();
  }

  public ngOnChanges(): void {
    if (this.autoClose && this.show) {
      this.clearAutoCloseTimer();
      this.startAutoCloseTimer();
    }
  }

  public close(): void {
    this.show = false;
    this.clearAutoCloseTimer();
    this.onClose.emit();
  }

  public getAlertClass(): string {
    return `alert-${this.type}`;
  }

  public getIconClass(): string {
    return ALERT_ICONS[this.type];
  }

  private startAutoCloseTimer(): void {
    this.autoCloseTimer = window.setTimeout(() => {
      this.close();
    }, this.autoCloseTime);
  }

  private clearAutoCloseTimer(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }
  }
}
