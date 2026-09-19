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
import { ITenantResumo } from '../../shared/models/http.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { ApiVercelService } from '../../shared/services/api-vercel-service/api-vercel.service';
import { LoadingService } from '../../shared/services/loading-service/loading.service';

@Component({
  selector: 'app-configuracao-tenant',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SkeletonComponent],
  templateUrl: './configuracao-tenant.component.html',
  styleUrls: ['./configuracao-tenant.component.scss'],
})
export class ConfiguracaoTenantComponent implements OnInit {
  public readonly carregandoTenants$: Observable<boolean>;

  public tenants: ITenantResumo[] = [];
  public tenantsFiltrados: ITenantResumo[] = [];
  public filtro = '';
  public tenantForm!: FormGroup;
  public salvando = false;
  public removendo = false;
  public testandoTenant: string | null = null;
  public mostrarFormulario = false;
  public tenantEditando: ITenantResumo | null = null;
  public tenantParaRemover: ITenantResumo | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly alertService: AlertService,
    private readonly apiVercelService: ApiVercelService,
    private readonly loadingService: LoadingService
  ) {
    this.carregandoTenants$ = this.loadingService.getLoadingByUrl(
      EBaseUrls.DEV_CONFIG
    );
  }

  public ngOnInit(): void {
    this.tenantForm = this.fb.group({
      tenant: [
        '',
        [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{1,62}$/)],
      ],
      serviceAccount: ['', [Validators.required]],
      databaseURL: [''],
    });

    this.carregarTenants();
  }

  get tenant() {
    return this.tenantForm.get('tenant');
  }

  get serviceAccount() {
    return this.tenantForm.get('serviceAccount');
  }

  get isEdicao(): boolean {
    return !!this.tenantEditando;
  }

  public carregarTenants(): void {
    this.apiVercelService.getTenants().subscribe({
      next: ({ data }) => {
        this.tenants = data?.tenants ?? [];
        this.aplicarFiltro();
      },
      error: error => {
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível carregar os tenants',
          'Erro'
        );
      },
    });
  }

  public aplicarFiltro(): void {
    if (!this.filtro.trim()) {
      this.tenantsFiltrados = [...this.tenants];
      return;
    }

    const filtroNormalizado = normalizarTexto(this.filtro);

    this.tenantsFiltrados = this.tenants.filter(({ tenant }) =>
      normalizarTexto(tenant).includes(filtroNormalizado)
    );
  }

  public abrirFormulario(): void {
    this.tenantEditando = null;
    this.tenantForm.reset({ tenant: '', serviceAccount: '', databaseURL: '' });

    this.tenant?.enable();
    this.serviceAccount?.setValidators([Validators.required]);
    this.serviceAccount?.updateValueAndValidity();

    this.mostrarFormulario = true;
  }

  public abrirEdicao(item: ITenantResumo): void {
    this.tenantEditando = item;
    this.tenantForm.reset({
      tenant: item.tenant,
      serviceAccount: '',
      databaseURL: item.databaseURL,
    });

    // O identificador é a chave do registro: alterá-lo criaria outro tenant
    // em vez de renomear.
    this.tenant?.disable();

    // Na edição a credencial é opcional — em branco, mantém a atual.
    this.serviceAccount?.clearValidators();
    this.serviceAccount?.updateValueAndValidity();

    this.mostrarFormulario = true;
  }

  public fecharFormulario(): void {
    this.mostrarFormulario = false;
    this.tenantEditando = null;
    this.tenant?.enable();
    // A chave privada não deve permanecer em memória depois do envio.
    this.tenantForm.reset({ tenant: '', serviceAccount: '', databaseURL: '' });
  }

  public provisionar(): void {
    if (this.tenantForm.invalid) {
      this.tenantForm.markAllAsTouched();
      return;
    }

    // getRawValue inclui o campo desabilitado na edição.
    const { tenant, serviceAccount, databaseURL } =
      this.tenantForm.getRawValue();

    this.salvando = true;

    // Sem credencial nova, só a URL do banco muda — não faz sentido exigir que
    // a chave privada seja baixada de novo apenas para isso.
    const requisicao =
      this.isEdicao && !serviceAccount?.trim()
        ? this.apiVercelService.atualizarTenant({ tenant, databaseURL })
        : this.apiVercelService.provisionarTenant({
            tenant,
            serviceAccount,
            databaseURL,
          });

    requisicao.subscribe({
      next: ({ message }) => {
        this.salvando = false;
        this.alertService.success(
          message || 'Tenant salvo com sucesso',
          'Sucesso'
        );
        this.fecharFormulario();
        this.carregarTenants();
      },
      error: error => {
        this.salvando = false;
        this.alertService.error(
          error?.error || error?.message || 'Não foi possível salvar o tenant',
          'Erro'
        );
      },
    });
  }

  public abrirRemocao(item: ITenantResumo): void {
    this.tenantParaRemover = item;
  }

  public fecharRemocao(): void {
    this.tenantParaRemover = null;
  }

  public confirmarRemocao(): void {
    if (!this.tenantParaRemover) {
      return;
    }

    this.removendo = true;

    this.apiVercelService
      .removerTenant({ tenant: this.tenantParaRemover.tenant })
      .subscribe({
        next: ({ message }) => {
          this.removendo = false;
          this.alertService.success(message || 'Tenant removido', 'Sucesso');
          this.fecharRemocao();
          this.carregarTenants();
        },
        error: error => {
          this.removendo = false;
          this.alertService.error(
            error?.error ||
              error?.message ||
              'Não foi possível remover o tenant',
            'Erro'
          );
        },
      });
  }

  public testarConexao(tenantNome: string): void {
    this.testandoTenant = tenantNome;

    this.apiVercelService
      .testarTenant({ tenant: tenantNome, disabledLoading: true })
      .subscribe({
        next: resposta => {
          this.testandoTenant = null;

          if (resposta?.success === false) {
            this.alertService.error(
              resposta?.error || 'Falha ao conectar com o projeto',
              `Tenant ${tenantNome}`
            );
            return;
          }

          this.alertService.success(
            'Conexão estabelecida com sucesso',
            `Tenant ${tenantNome}`
          );
        },
        error: error => {
          this.testandoTenant = null;
          this.alertService.error(
            error?.error || error?.message || 'Falha ao testar a conexão',
            `Tenant ${tenantNome}`
          );
        },
      });
  }
}
