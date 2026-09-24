import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Observable } from 'rxjs';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { EBaseUrls } from '../../shared/enums/url-http.enum';
import { normalizarTexto } from '../../shared/functions/sistema.function';
import {
  EGatewayFeeType,
  EGatewayIntegration,
  ITenantGatewayConfig,
} from '../../shared/models/api-catra.model';
import { ITenantResumo } from '../../shared/models/http.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { ApiVercelService } from '../../shared/services/api-vercel-service/api-vercel.service';
import { LoadingService } from '../../shared/services/loading-service/loading.service';

/**
 * Origem da credencial Firebase (opcional) enviada junto com a config de
 * gateway. 'sync' reaproveita o service account já provisionado deste tenant
 * no painel (Configuração de Tenants) sem que a privateKey passe pelo browser
 * - a busca e o envio ao srv-catra acontecem inteiramente no backend. 'manual'
 * existe para tenants que o srv-catra gerencia mas que este painel não
 * provisionou.
 */
type TFirebaseSource = 'none' | 'sync' | 'manual';

/**
 * Todo tenant do Fitware termina com "-fitware": é o mesmo termo que o backend usa
 * para filtrar a listagem, então um identificador fora do padrão seria criado no
 * srv-catra e nunca apareceria nesta tela. O mínimo de 9 caracteres vem de 1 (início)
 * + 8 do sufixo, e o máximo de 54 no meio mantém o total dentro dos 63 permitidos.
 */
const PADRAO_TENANT_FITWARE = /^[a-z0-9][a-z0-9-]{0,54}-fitware$/;

/** Domínio onde cada tenant tem seu próprio subdomínio (app do cliente). */
const DOMINIO_BASE_REDIRECT = 'gestaoacademia.app.br';

const ROTULOS_INTEGRATION: Record<string, string> = {
  [EGatewayIntegration.FITWARE_MERCADO_PAGO_DEVELOP]: 'Mercado Pago (Develop)',
  [EGatewayIntegration.FITWARE_MERCADO_PAGO_PRODUCTION]:
    'Mercado Pago (Production)',
};

@Component({
  selector: 'app-configuracao-gateway',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgSelectModule,
    SkeletonComponent,
  ],
  templateUrl: './configuracao-gateway.component.html',
  styleUrls: ['./configuracao-gateway.component.scss'],
})
export class ConfiguracaoGatewayComponent implements OnInit {
  public readonly carregandoGatewayConfigs$: Observable<boolean>;

  public readonly opcoesIntegration = Object.values(EGatewayIntegration);
  public readonly opcoesFeeType = Object.values(EGatewayFeeType);
  public readonly rotulosIntegration = ROTULOS_INTEGRATION;

  /** Tenants do fitmanager-util, para o select de vínculo com o config store do Fitware. */
  public tenantsFirebase: ITenantResumo[] = [];

  public itens: ITenantGatewayConfig[] = [];
  public itensFiltrados: ITenantGatewayConfig[] = [];
  public filtro = '';
  public gatewayForm!: FormGroup;
  public salvando = false;
  public removendo = false;
  public mostrarFormulario = false;
  public itemEditando: ITenantGatewayConfig | null = null;
  public itemParaRemover: ITenantGatewayConfig | null = null;

  /** Exclusão definitiva do tenant: só habilita o botão depois de digitar o tenantId. */
  public itemParaExcluir: ITenantGatewayConfig | null = null;
  public confirmacaoExclusao = '';
  public excluindo = false;

  /**
   * Enquanto false, redirectTenantUri acompanha automaticamente o
   * targetTenantId digitado (só na criação — na edição o tenant é fixo).
   * Vira true assim que a pessoa editar o campo com a própria mão, e a partir
   * daí para de sobrescrever o que ela escreveu.
   */
  private redirectUriEditadoManualmente = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly alertService: AlertService,
    private readonly apiVercelService: ApiVercelService,
    private readonly loadingService: LoadingService
  ) {
    this.carregandoGatewayConfigs$ = this.loadingService.getLoadingByUrl(
      EBaseUrls.DEV_CONFIG
    );
  }

  public ngOnInit(): void {
    this.gatewayForm = this.fb.group({
      targetTenantId: [
        '',
        [Validators.required, Validators.pattern(PADRAO_TENANT_FITWARE)],
      ],
      company: ['', [Validators.required]],
      gatewayActive: [true],
      integration: ['', [Validators.required]],
      marketplaceFeeType: [EGatewayFeeType.FIXED, [Validators.required]],
      marketplaceFeeValue: [null, [Validators.required, Validators.min(0.01)]],
      redirectTenantUri: ['', [Validators.required]],
      firebaseSource: ['none' as TFirebaseSource],
      serviceAccountJson: [''],
      firebaseTenant: [null as string | null],
      habilitarPix: [false],
      habilitarBoleto: [false],
    });

    // Auto-preenche a URL de retorno a partir do tenant, só até a pessoa
    // editar o campo com a própria mão (setValue com emitEvent: false abaixo
    // não conta como edição manual, então continua acompanhando depois).
    this.targetTenantId?.valueChanges.subscribe(tenantId => {
      if (this.isEdicao || this.redirectUriEditadoManualmente) {
        return;
      }
      this.redirectTenantUri?.setValue(this.gerarRedirectTenantUri(tenantId), {
        emitEvent: false,
      });
    });

    this.redirectTenantUri?.valueChanges.subscribe(() => {
      this.redirectUriEditadoManualmente = true;
    });

    this.carregarGatewayConfigs();
    this.carregarTenantsFirebase();
  }

  private carregarTenantsFirebase(): void {
    // disabledLoading: é uma carga de apoio do select, não deve piscar o
    // skeleton da tabela junto com a listagem principal.
    this.apiVercelService.getTenants(true).subscribe({
      next: ({ data }) => {
        this.tenantsFirebase = data?.tenants ?? [];
      },
      error: () => {
        // Falhar aqui não impede configurar o gateway — só o vínculo fica indisponível.
        this.alertService.error(
          'Não foi possível carregar os tenants para vínculo',
          'Erro'
        );
      },
    });
  }

  private gerarRedirectTenantUri(tenantId: string): string {
    const tenantNormalizado = (tenantId || '').trim().toLowerCase();

    if (!tenantNormalizado) {
      return '';
    }

    return `https://${tenantNormalizado}.${DOMINIO_BASE_REDIRECT}/dashboard`;
  }

  get targetTenantId() {
    return this.gatewayForm.get('targetTenantId');
  }

  get company() {
    return this.gatewayForm.get('company');
  }

  get integration() {
    return this.gatewayForm.get('integration');
  }

  get marketplaceFeeValue() {
    return this.gatewayForm.get('marketplaceFeeValue');
  }

  get redirectTenantUri() {
    return this.gatewayForm.get('redirectTenantUri');
  }

  get firebaseSource(): TFirebaseSource {
    return this.gatewayForm.get('firebaseSource')?.value ?? 'none';
  }

  get isEdicao(): boolean {
    return !!this.itemEditando;
  }

  get firebaseTenant() {
    return this.gatewayForm.get('firebaseTenant');
  }

  /**
   * Obrigatório só ao editar uma config que JÁ tem vínculo: aí o campo vem
   * preenchido e exigi-lo impede que salvar sem querer deixe o srv-catra e o app
   * do cliente diferentes. Na criação, e em configs ainda sem vínculo, continua
   * opcional - o select lista só tenants provisionados, e nem todo tenant do
   * srv-catra é do Fitware.
   */
  get vinculoObrigatorio(): boolean {
    return !!this.itemEditando?.firebaseTenant;
  }

  get exclusaoConfirmada(): boolean {
    return (
      !!this.itemParaExcluir &&
      this.confirmacaoExclusao.trim() === this.itemParaExcluir.tenantId
    );
  }

  public carregarGatewayConfigs(): void {
    this.apiVercelService.getGatewayConfigs().subscribe({
      next: ({ data }) => {
        this.itens = data?.items ?? [];
        this.aplicarFiltro();
      },
      error: error => {
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível carregar as configurações de gateway',
          'Erro'
        );
      },
    });
  }

  public aplicarFiltro(): void {
    if (!this.filtro.trim()) {
      this.itensFiltrados = [...this.itens];
      return;
    }

    const filtroNormalizado = normalizarTexto(this.filtro);

    this.itensFiltrados = this.itens.filter(
      ({ tenantId, company }) =>
        normalizarTexto(tenantId).includes(filtroNormalizado) ||
        normalizarTexto(company).includes(filtroNormalizado)
    );
  }

  private valoresPadrao() {
    return {
      targetTenantId: '',
      company: '',
      gatewayActive: true,
      integration: '',
      marketplaceFeeType: EGatewayFeeType.FIXED,
      marketplaceFeeValue: null,
      redirectTenantUri: '',
      firebaseSource: 'none' as TFirebaseSource,
      serviceAccountJson: '',
      firebaseTenant: null,
      habilitarPix: false,
      habilitarBoleto: false,
    };
  }

  public abrirFormulario(): void {
    this.itemEditando = null;
    this.redirectUriEditadoManualmente = false;
    this.gatewayForm.reset(this.valoresPadrao());
    this.targetTenantId?.enable();

    this.firebaseTenant?.clearValidators();
    this.firebaseTenant?.updateValueAndValidity();

    this.mostrarFormulario = true;
  }

  public abrirEdicao(item: ITenantGatewayConfig): void {
    this.itemEditando = item;
    // Tenant já é fixo na edição (targetTenantId fica desabilitado abaixo), então
    // não há por que recalcular a URL a partir dele - trata como já "manual".
    this.redirectUriEditadoManualmente = true;
    this.gatewayForm.reset({
      targetTenantId: item.tenantId,
      company: item.company,
      // Tenant sem gateway ainda (veio da listagem via `search`) nasce ativo
      // por padrão, igual ao comportamento do backend ao anexar pela primeira vez.
      gatewayActive: item.gateway?.active ?? true,
      integration: item.gateway?.integration ?? '',
      marketplaceFeeType:
        item.gateway?.marketplaceFee?.type ?? EGatewayFeeType.FIXED,
      marketplaceFeeValue: item.gateway?.marketplaceFee?.value ?? null,
      redirectTenantUri: item.gateway?.redirectTenantUri ?? '',
      firebaseSource: 'none' as TFirebaseSource,
      serviceAccountJson: '',
      // Pré-selecionado com o vínculo atual para que salvar uma edição sempre
      // propague as mudanças ao app do tenant. Deixar em branco não desfaz o
      // vínculo, mas faz o Firebase ficar defasado em relação ao srv-catra.
      firebaseTenant: item.firebaseTenant ?? null,
      habilitarPix: false,
      habilitarBoleto: false,
    });

    // O identificador é a chave do registro no srv-catra: alterá-lo criaria
    // outra configuração em vez de editar esta.
    this.targetTenantId?.disable();

    if (this.vinculoObrigatorio) {
      this.firebaseTenant?.setValidators([Validators.required]);
    } else {
      this.firebaseTenant?.clearValidators();
    }
    this.firebaseTenant?.updateValueAndValidity();

    this.mostrarFormulario = true;
  }

  public fecharFormulario(): void {
    this.mostrarFormulario = false;
    this.itemEditando = null;
    this.targetTenantId?.enable();
    // O JSON colado (quando usado) não deve permanecer em memória depois do envio.
    this.gatewayForm.reset(this.valoresPadrao());
  }

  public salvar(): void {
    if (this.gatewayForm.invalid) {
      this.gatewayForm.markAllAsTouched();
      return;
    }

    // getRawValue inclui o campo desabilitado na edição.
    const {
      targetTenantId,
      company,
      gatewayActive,
      integration,
      marketplaceFeeType,
      marketplaceFeeValue,
      redirectTenantUri,
      firebaseSource,
      serviceAccountJson,
      firebaseTenant,
      habilitarPix,
      habilitarBoleto,
    } = this.gatewayForm.getRawValue();

    const camposFirebase = {
      syncFirebaseFromTenant: firebaseSource === 'sync',
      serviceAccountJson:
        firebaseSource === 'manual' ? serviceAccountJson : undefined,
    };

    const camposVinculo = {
      firebaseTenant: firebaseTenant || undefined,
      habilitarPix,
      habilitarBoleto,
    };

    this.salvando = true;

    const requisicao = this.isEdicao
      ? this.apiVercelService.atualizarGatewayConfig({
          targetTenantId,
          company,
          gatewayActive,
          integration,
          marketplaceFee: {
            type: marketplaceFeeType,
            value: marketplaceFeeValue,
          },
          redirectTenantUri,
          ...camposFirebase,
          ...camposVinculo,
        })
      : this.apiVercelService.criarGatewayConfig({
          targetTenantId,
          company,
          integration,
          marketplaceFee: {
            type: marketplaceFeeType,
            value: marketplaceFeeValue,
          },
          redirectTenantUri,
          ...camposFirebase,
          ...camposVinculo,
        });

    requisicao.subscribe({
      next: ({ success, message }) => {
        this.salvando = false;

        // A config pode ter sido salva no srv-catra e o vínculo com o Firebase
        // falhar: nesse caso o backend devolve success: false com a explicação,
        // e a tela precisa recarregar do mesmo jeito (a config existe).
        if (success === false) {
          this.alertService.error(
            message || 'Não foi possível concluir o vínculo',
            'Atenção'
          );
        } else {
          this.alertService.success(
            message || 'Configuração de gateway salva com sucesso',
            'Sucesso'
          );
          this.fecharFormulario();
        }

        this.carregarGatewayConfigs();
      },
      error: error => {
        this.salvando = false;
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível salvar a configuração de gateway',
          'Erro'
        );
      },
    });
  }

  public abrirRemocao(item: ITenantGatewayConfig): void {
    this.itemParaRemover = item;
  }

  public fecharRemocao(): void {
    this.itemParaRemover = null;
  }

  public abrirExclusao(item: ITenantGatewayConfig): void {
    this.confirmacaoExclusao = '';
    this.itemParaExcluir = item;
  }

  public fecharExclusao(): void {
    this.itemParaExcluir = null;
    this.confirmacaoExclusao = '';
  }

  public confirmarExclusao(): void {
    // Confere de novo aqui, não só no [disabled] do botão: Enter/atalhos não
    // podem disparar uma exclusão irreversível sem o tenantId digitado.
    if (!this.itemParaExcluir || !this.exclusaoConfirmada) {
      return;
    }

    const { tenantId } = this.itemParaExcluir;

    this.excluindo = true;

    this.apiVercelService
      .excluirTenantGateway({ targetTenantId: tenantId })
      .subscribe({
        next: ({ message }) => {
          this.excluindo = false;
          this.alertService.success(
            message || `Tenant "${tenantId}" excluído`,
            'Sucesso'
          );
          this.fecharExclusao();
          this.carregarGatewayConfigs();
        },
        error: error => {
          this.excluindo = false;
          this.alertService.error(
            error?.error ||
              error?.message ||
              'Não foi possível excluir o tenant',
            'Erro'
          );
        },
      });
  }

  public confirmarRemocao(): void {
    if (!this.itemParaRemover) {
      return;
    }

    this.removendo = true;

    this.apiVercelService
      .removerGatewayConfig({ targetTenantId: this.itemParaRemover.tenantId })
      .subscribe({
        next: ({ message }) => {
          this.removendo = false;
          this.alertService.success(
            message || 'Configuração de gateway removida',
            'Sucesso'
          );
          this.fecharRemocao();
          this.carregarGatewayConfigs();
        },
        error: error => {
          this.removendo = false;
          this.alertService.error(
            error?.error ||
              error?.message ||
              'Não foi possível remover a configuração de gateway',
            'Erro'
          );
        },
      });
  }
}
