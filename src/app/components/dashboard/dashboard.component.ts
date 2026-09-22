import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ERoutes } from '../../shared/enums/routes.enum';
import { EStatusConexaoGoogle } from '../../shared/models/http.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { ApiVercelService } from '../../shared/services/api-vercel-service/api-vercel.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SkeletonComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  public totalTenants: number | null = null;
  public totalMercadoPagoConfigurado: number | null = null;
  public carregando = false;

  public conexaoGoogleExpirada = false;
  public ultimoErroConexaoGoogle = '';
  public readonly rotaCriarProjeto = ERoutes.CRIAR_PROJETO;

  constructor(
    private readonly alertService: AlertService,
    private readonly apiVercelService: ApiVercelService
  ) {}

  public ngOnInit(): void {
    this.carregarResumo();
    this.verificarConexaoGoogle();
  }

  /**
   * O cron diário marca a conexão como EXPIRADA quando o refresh token é
   * revogado. Mostrar isso aqui é o que torna o cron útil: o problema aparece
   * no dia seguinte, e não na hora em que alguém precisa criar um tenant.
   *
   * Falhas desta verificação são silenciosas de propósito — ela é acessória ao
   * dashboard, e um alerta vermelho aqui competiria com o erro dos cards.
   */
  private verificarConexaoGoogle(): void {
    this.apiVercelService.getStatusConexaoGoogle(true).subscribe({
      next: ({ data }) => {
        this.conexaoGoogleExpirada =
          !!data?.conectado &&
          data.statusConexao === EStatusConexaoGoogle.EXPIRADA;
        this.ultimoErroConexaoGoogle = data?.ultimoErro ?? '';
      },
      error: () => {
        this.conexaoGoogleExpirada = false;
      },
    });
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
