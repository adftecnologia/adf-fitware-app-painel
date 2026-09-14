import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AlertService } from '../../../services/alert-service/alert.service';
import { AlertComponent } from '../alert.component';
import { IAlert } from '../../../models/alert.model';

@Component({
  selector: 'app-alert-container',
  standalone: true,
  imports: [CommonModule, AlertComponent],
  templateUrl: './alert-container.component.html',
  styleUrls: ['./alert-container.component.css'],
})
export class AlertContainerComponent implements OnInit, OnDestroy {
  public alerts: IAlert[] = [];
  private subscription!: Subscription;

  constructor(private alertService: AlertService) {}

  public ngOnInit(): void {
    this.subscription = this.alertService.alerts$.subscribe(
      alerts => (this.alerts = alerts)
    );
  }

  public ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  public onAlertClose(id: string): void {
    this.alertService.close(id);
  }

  public trackByAlertId(index: number, alert: IAlert): string {
    return alert.id;
  }
}
