import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { ApiVercelService } from '../../shared/services/api-vercel-service/api-vercel.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  public totalTenants: number | null = null;
  public totalMercadoPagoConfigurado: number | null = null;
  public carregando = false;

  constructor(
    private readonly alertService: AlertService,
    private readonly apiVercelService: ApiVercelService
  ) {}

  public ngOnInit(): void {
    this.carregarResumo();
  }

  private carregarResumo(): void {
    this.carregando = true;

    // getStatusGateway já percorre os tenants provisionados pra apurar o
    // Mercado Pago, então devolve o total de tenants de graça — evita ler
    // clientes/serviceAccounts duas vezes a cada carregamento do dashboard.
    this.apiVercelService.getStatusGateway().subscribe({
      next: ({ data }) => {
        this.totalTenants = data?.total ?? 0;
        this.totalMercadoPagoConfigurado = data?.configurados ?? 0;
        this.carregando = false;
      },
      error: error => {
        this.carregando = false;
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível carregar o resumo do dashboard',
          'Erro'
        );
      },
    });
  }
}
