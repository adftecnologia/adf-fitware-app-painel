import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { Subscription } from 'rxjs';
import {
  GRAFICO_BARRA_INDICANTE_DASHBOARD_CONFIG,
  GRAFICO_BARRA_SECRETARIA_DASHBOARD_CONFIG,
} from '../../shared/constants/grafico.const';
import { BADGE_TIPO_CONTRATO } from '../../shared/constants/sistema.const';
import { ERoutes } from '../../shared/enums/routes.enum';
import { ETipoContrato } from '../../shared/enums/sistema.enum';
import {
  getTipoContratoByValue,
  getUsernameAcronym,
} from '../../shared/functions/sistema.function';
import {
  IDashboardCount,
  IDashboardStats,
  IFornecedor,
  IPessoa,
  ISecretaria,
} from '../../shared/models/sistema.model';
import { DataService } from '../../shared/services/data-service/data.service';
import { FeatureToggleService } from '../../shared/services/featuretoggle-service/featuretoggle.service';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnDestroy, AfterViewInit {
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChart') pieChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChartIndicante')
  barChartIndicanteRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChartSecretaria')
  barChartSecretariaRef!: ElementRef<HTMLCanvasElement>;

  private subscriptions: Subscription[] = [];
  private barChartIndicante: Chart | null = null;
  private barChartSecretaria: Chart | null = null;
  indicantes: IFornecedor[] = [];
  secretarias: ISecretaria[] = [];

  public readonly routes = ERoutes;

  public stats: IDashboardStats | null = null;
  public dataCounts: IDashboardCount = {
    totalPessoas: 0,
    totalSecretarias: 0,
    mediaSalarial: 0,
  };

  constructor(
    private readonly dataService: DataService,
    public readonly featureToggleService: FeatureToggleService
  ) {}

  public ngAfterViewInit(): void {
    // Aguarda um pouco para garantir que os elementos estão renderizados
    setTimeout(() => {
      this.initializeCharts();
      this.loadDataCounts();
    }, 100);
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());

    if (this.barChartIndicante) {
      this.barChartIndicante.destroy();
    }
    if (this.barChartSecretaria) {
      this.barChartSecretaria.destroy();
    }
  }

  private async loadDataCounts() {
    const pessoasSub = this.dataService.getPessoas.subscribe(pessoas => {
      this.dataCounts.totalPessoas = pessoas.length;
      this.dataCounts.mediaSalarial = this.getMediaSalarial(pessoas);
    });

    const secretariasSub = this.dataService.getSecretarias.subscribe(
      secretarias => {
        this.dataCounts.totalSecretarias = secretarias.length;
        this.secretarias = secretarias;
        this.loadDashboardData();
      }
    );

    this.subscriptions.push(pessoasSub, secretariasSub);
  }

  private loadDashboardData(): void {
    const subscription = this.dataService
      .getDashboardStats(this.secretarias, this.indicantes)
      .subscribe(stats => {
        this.stats = stats;
        this.updateCharts();
      });

    this.subscriptions.push(subscription);
  }

  private initializeCharts(): void {
    if (this.barChartIndicanteRef && this.barChartSecretariaRef) {
      this.createBarChartIndicante();
      this.createBarChartSecretaria();
    }
  }

  private createBarChartIndicante(): void {
    const ctx = this.barChartIndicanteRef.nativeElement.getContext('2d');
    if (!ctx) return;
    this.barChartIndicante = new Chart(
      ctx,
      GRAFICO_BARRA_INDICANTE_DASHBOARD_CONFIG
    );
  }

  private createBarChartSecretaria(): void {
    const ctx = this.barChartSecretariaRef.nativeElement.getContext('2d');
    if (!ctx) return;
    this.barChartSecretaria = new Chart(
      ctx,
      GRAFICO_BARRA_SECRETARIA_DASHBOARD_CONFIG
    );
  }

  private updateCharts(): void {
    if (!this.stats) return;

    // Atualizar gráfico de barras (Pessoas por Indicante)
    // if (this.barChartIndicante) {
    //   const indicanteLabels = Object.keys(this.stats.pessoasPorIndicante);
    //   const indicanteData = Object.values(this.stats.pessoasPorIndicante);

    //   this.barChartIndicante.data.labels = indicanteLabels;
    //   this.barChartIndicante.data.datasets[0].data = indicanteData;
    //   this.barChartIndicante.update();
    // }

    // Atualizar gráfico de barras (Pessoas por Secretaria)
    if (this.barChartSecretaria) {
      const secretariaLabels = Object.keys(this.stats.pessoasPorSecretaria);
      const secretariaData = Object.values(this.stats.pessoasPorSecretaria);

      this.barChartSecretaria.data.labels = secretariaLabels;
      this.barChartSecretaria.data.datasets[0].data = secretariaData;
      this.barChartSecretaria.update();
    }
  }

  public formatDate(dateString: string): string {
    if (!dateString) {
      return 'Não informado';
    }

    const datePart =
      dateString.length >= 10 ? dateString.substring(0, 10) : dateString;
    const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return dateString;
    }

    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  public getUsernameAcronym(name: string): string {
    return getUsernameAcronym(name);
  }

  public getTipoContratoByValue(value: ETipoContrato): string {
    return getTipoContratoByValue(value);
  }

  public getTipoContratoBadgeClass(tipoContrato: ETipoContrato): string {
    return BADGE_TIPO_CONTRATO[tipoContrato] || 'badge-primary';
  }

  private getMediaSalarial(pessoas: IPessoa[]): number {
    if (!pessoas || pessoas.length === 0) {
      return 0;
    }
    return pessoas.reduce((sum, p) => sum + p.salario, 0) / pessoas.length;
  }

  public getIndicanteNomeById(id: string): string {
    const indicante = this.indicantes.find(ind => ind.id === id);
    return indicante ? indicante.nome : 'N/A';
  }

  public getSecretariaNomeById(id: string): string {
    const secretaria = this.secretarias.find(sec => sec.id === id);
    return secretaria ? secretaria.nome : 'N/A';
  }
}
