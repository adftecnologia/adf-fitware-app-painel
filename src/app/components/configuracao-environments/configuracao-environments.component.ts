import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Observable } from 'rxjs';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { EBaseUrls } from '../../shared/enums/url-http.enum';
import { normalizarTexto } from '../../shared/functions/sistema.function';
import { IEnvironmentResumo } from '../../shared/models/http.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { ApiVercelService } from '../../shared/services/api-vercel-service/api-vercel.service';
import { LoadingService } from '../../shared/services/loading-service/loading.service';

@Component({
  selector: 'app-configuracao-environments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SkeletonComponent],
  templateUrl: './configuracao-environments.component.html',
  styleUrls: ['./configuracao-environments.component.scss'],
})
export class ConfiguracaoEnvironmentsComponent implements OnInit {
  public readonly carregandoEnvironments$: Observable<boolean>;

  public environments: IEnvironmentResumo[] = [];
  public environmentsFiltrados: IEnvironmentResumo[] = [];
  public filtro = '';
  public environmentForm!: FormGroup;
  public salvando = false;
  public removendo = false;
  public mostrarFormulario = false;
  public environmentEditando: IEnvironmentResumo | null = null;
  public environmentParaRemover: IEnvironmentResumo | null = null;

  /** Tenant aguardando confirmação para ser habilitado ou desabilitado. */
  public environmentParaAlternar: IEnvironmentResumo | null = null;
  public alternandoStatus = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly alertService: AlertService,
    private readonly apiVercelService: ApiVercelService,
    private readonly loadingService: LoadingService
  ) {
    this.carregandoEnvironments$ = this.loadingService.getLoadingByUrl(
      EBaseUrls.DEV_CONFIG
    );
  }

  public ngOnInit(): void {
    this.environmentForm = this.fb.group({
      tenant: [
        '',
        [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{1,62}$/)],
      ],
      apiKey: ['', [Validators.required]],
      authDomain: ['', [Validators.required]],
      databaseURL: ['', [Validators.required]],
      projectId: ['', [Validators.required]],
      storageBucket: ['', [Validators.required]],
      messagingSenderId: ['', [Validators.required]],
      appId: ['', [Validators.required]],
      measurementId: [''],
    });

    this.carregarEnvironments();
  }

  get tenant() {
    return this.environmentForm.get('tenant');
  }

  get isEdicao(): boolean {
    return !!this.environmentEditando;
  }

  public carregarEnvironments(): void {
    this.apiVercelService.getEnvironments().subscribe({
      next: ({ data }) => {
        this.environments = data?.environments ?? [];
        this.aplicarFiltro();
      },
      error: error => {
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível carregar os environments',
          'Erro'
        );
      },
    });
  }

  public aplicarFiltro(): void {
    if (!this.filtro.trim()) {
      this.environmentsFiltrados = [...this.environments];
      return;
    }

    const filtroNormalizado = normalizarTexto(this.filtro);

    this.environmentsFiltrados = this.environments.filter(({ tenant }) =>
      normalizarTexto(tenant).includes(filtroNormalizado)
    );
  }

  public abrirFormulario(): void {
    this.environmentEditando = null;
    this.environmentForm.reset({
      tenant: '',
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
      measurementId: '',
    });

    this.tenant?.enable();

    this.mostrarFormulario = true;
  }

  public abrirEdicao(item: IEnvironmentResumo): void {
    this.environmentEditando = item;
    this.environmentForm.reset({
      tenant: item.tenant,
      ...item.config,
    });

    // O identificador é a chave do registro: alterá-lo criaria outro
    // environment em vez de renomear.
    this.tenant?.disable();

    this.mostrarFormulario = true;
  }

  public fecharFormulario(): void {
    this.mostrarFormulario = false;
    this.environmentEditando = null;
    this.tenant?.enable();
    this.environmentForm.reset({
      tenant: '',
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
      measurementId: '',
    });
  }

  public salvar(): void {
    if (this.environmentForm.invalid) {
      this.environmentForm.markAllAsTouched();
      return;
    }

    // getRawValue inclui o campo desabilitado na edição.
    const { tenant, ...config } = this.environmentForm.getRawValue();

    this.salvando = true;

    const requisicao = this.isEdicao
      ? this.apiVercelService.atualizarEnvironment({ tenant, config })
      : this.apiVercelService.salvarEnvironment({ tenant, config });

    requisicao.subscribe({
      next: ({ message }) => {
        this.salvando = false;
        this.alertService.success(
          message || 'Environment salvo com sucesso',
          'Sucesso'
        );
        this.fecharFormulario();
        this.carregarEnvironments();
      },
      error: error => {
        this.salvando = false;
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível salvar o environment',
          'Erro'
        );
      },
    });
  }

  public abrirRemocao(item: IEnvironmentResumo): void {
    this.environmentParaRemover = item;
  }

  public fecharRemocao(): void {
    this.environmentParaRemover = null;
  }

  public confirmarRemocao(): void {
    if (!this.environmentParaRemover) {
      return;
    }

    this.removendo = true;

    this.apiVercelService
      .removerEnvironment({ tenant: this.environmentParaRemover.tenant })
      .subscribe({
        next: ({ message }) => {
          this.removendo = false;
          this.alertService.success(
            message || 'Environment removido',
            'Sucesso'
          );
          this.fecharRemocao();
          this.carregarEnvironments();
        },
        error: error => {
          this.removendo = false;
          this.alertService.error(
            error?.error ||
              error?.message ||
              'Não foi possível remover o environment',
            'Erro'
          );
        },
      });
  }

  /// HABILITAR E DESABILITAR ///

  public abrirAlternarStatus(item: IEnvironmentResumo): void {
    this.environmentParaAlternar = item;
  }

  public fecharAlternarStatus(): void {
    this.environmentParaAlternar = null;
  }

  public confirmarAlternarStatus(): void {
    const item = this.environmentParaAlternar;

    if (!item) {
      return;
    }

    this.alternandoStatus = true;

    this.apiVercelService
      .alternarStatusEnvironment({
        tenant: item.tenant,
        // Manda o estado desejado, não um "inverta": se a lista estiver
        // desatualizada, o backend recusa dizendo que já está assim, em vez de
        // alternar para o lado errado.
        habilitar: !item.habilitado,
      })
      .subscribe({
        next: ({ message }) => {
          this.alternandoStatus = false;
          this.fecharAlternarStatus();
          this.alertService.success(message || 'Status alterado', 'Sucesso');
          this.carregarEnvironments();
        },
        error: error => {
          this.alternandoStatus = false;
          this.fecharAlternarStatus();
          this.alertService.error(
            error?.error ||
              error?.message ||
              'Não foi possível alterar o status do tenant',
            'Erro'
          );
        },
      });
  }
}
