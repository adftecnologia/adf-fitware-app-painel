import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { LoadingComponent } from './shared/components/loading/loading.component';
import { PdfModalComponent } from './shared/components/pdf-modal/pdf-modal.component';
import { LoadingService } from './shared/services/loading-service/loading.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, LoadingComponent, PdfModalComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  public loadingService: LoadingService = inject(LoadingService);
  public environment = environment;
}
