import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TimelineComponent } from '../../shared/components/timeline/timeline.component';
import { EBaseUrls } from '../../shared/enums/url-http.enum';
import { normalizarTexto } from '../../shared/functions/sistema.function';
import {
  EEtapaProvisionamento,
  EStatusConexaoGoogle,
  EStatusProvisionamento,
  IEtapaDescrita,
  IGoogleOAuthStatusResponse,
  IProvisionamentoResumo,
} from '../../shared/models/http.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { ApiVercelService } from '../../shared/services/api-vercel-service/api-vercel.service';
import { LoadingService } from '../../shared/services/loading-service/loading.service';

/**
 * Criação automatizada de um projeto Firebase para um tenant novo.
 *
 * O fluxo é dividido em etapas executadas uma por requisição (ver
 * lib/helper/provisionamento.helper.ts). Esta tela dispara a sequência e
 * acompanha o progresso; se algo falhar, o estado fica gravado no
 * fitmanager-util e o botão "Tentar novamente" retoma de onde parou.
 */
@Component({
  selector: 'app-criar-projeto',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SkeletonComponent,
    TimelineComponent,
  ],
  templateUrl: './criar-projeto.component.html',
  styleUrls: ['./criar-projeto.component.scss'],
})
export class CriarProjetoComponent implements OnInit {
  public readonly carregando$: Observable<boolean>;

  public readonly EStatusConexaoGoogle = EStatusConexaoGoogle;
  public readonly EStatusProvisionamento = EStatusProvisionamento;

  public conexao: IGoogleOAuthStatusResponse | null = null;
  public conectando = false;
  public desconectando = false;
  public consultandoConexao = false;
  public confirmandoDesconexao = false;

  public form!: FormGroup;
  public etapas: IEtapaDescrita[] = [];
  public locaisRtdb: string[] = [];

  public provisionamentos: IProvisionamentoResumo[] = [];
  public provisionamentosFiltrados: IProvisionamentoResumo[] = [];
  public filtro = '';

  /** Modal do formulário de criação. */
  public mostrarFormulario = false;

  /** Provisionamento exibido no modal de timeline. */
  public provisionamentoAberto: IProvisionamentoResumo | null = null;

  /**
   * Senha do admin usada ao retomar.
   *
   * Vive só em memória: o backend não a persiste, então ao voltar numa criação
   * parada na última etapa ela precisa ser digitada de novo.
   */
  public senhaRetomada = '';

  public executando = false;

  /**
   * Tenant que o laço de etapas está processando.
   *
   * Separado de `provisionamentoAberto` de propósito: assim dá para abrir a
   * timeline de outra criação enquanto uma execução corre, sem o laço passar a
   * mirar no tenant errado.
   */
  private tenantEmExecucao: string | null = null;

  public provisionamentoParaDescartar: IProvisionamentoResumo | null = null;
  public descartando = false;

  /**
   * Tenants habilitados, por nome.
   *
   * O registro de provisionamento não sabe se o tenant está habilitado — quem
   * guarda isso é `clientes/firebaseConfigs`. Por isso a tela consulta os
   * environments para montar este mapa.
   */
  private tenantsHabilitados = new Set<string>();

  public provisionamentoParaAlternar: IProvisionamentoResumo | null = null;
  public alternandoStatus = false;

  /**
   * Marca se o usuário editou o ID do projeto à mão. Enquanto não editou, o
   * campo acompanha o nome do tenant; depois disso, paramos de sobrescrever.
   */
  private projectIdEditadoManualmente = false;

  /**
   * Trava do laço de etapas. O backend sempre avança ou marca erro, então na
   * prática nunca é atingida — existe para que um estado inesperado não vire
   * um laço infinito de requisições contra a função.
   */
  private etapasExecutadasNestaSessao = 0;
  private readonly LIMITE_ETAPAS_POR_SESSAO = 60;

  /**
   * Pausa entre uma etapa e a seguinte.
   *
   * Não é enfeite: recursos do Google recém-criados levam alguns segundos para
   * ficar visíveis para a chamada seguinte, e esperar aqui — entre requisições
   * — é mais barato que esperar dentro da função, que tem maxDuration de 60s.
   * Também torna o progresso legível, em vez de tudo piscar de uma vez.
   */
  private readonly PAUSA_ENTRE_ETAPAS_MS = 1500;

  /**
   * Espera quando o backend avisou que está aguardando propagação, crescendo a
   * cada tentativa até o teto.
   *
   * Habilitação de API é o caso lento: o próprio Google responde "wait a few
   * minutes for the action to propagate". Uma pausa fixa curta gastava as
   * tentativas antes disso acontecer.
   */
  private readonly PAUSA_PROPAGACAO_MS = 5000;
  private readonly PAUSA_PROPAGACAO_MAXIMA_MS = 30000;

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly alertService: AlertService,
    private readonly apiVercelService: ApiVercelService,
    private readonly loadingService: LoadingService
  ) {
    this.carregando$ = this.loadingService.getLoadingByUrl(
      EBaseUrls.DEV_CONFIG
    );
  }

  public ngOnInit(): void {
    this.form = this.fb.group({
      tenant: [
        '',
        [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{1,62}$/)],
      ],
      projectId: [
        '',
        [
          Validators.required,
          // Regras do Google, mais estritas que as do nome do tenant: 6 a 30
          // caracteres, começando por letra e sem terminar em hífen.
          Validators.pattern(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/),
        ],
      ],
      displayName: [
        '',
        // O Google recusa nome exibido fora da faixa de 4 a 30 caracteres.
        [
          Validators.required,
          Validators.minLength(4),
          Validators.maxLength(30),
        ],
      ],
      locationId: ['us-central1', [Validators.required]],
      nomeEmpresa: ['', [Validators.required]],
      adminNome: ['', [Validators.required]],
      adminEmail: ['', [Validators.required, Validators.email]],
      adminSenha: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.tratarRetornoDoGoogle();

    // Só `carregarProvisionamentos` alimenta o esqueleto da página. As outras
    // duas rodam com disabledLoading porque o LoadingService guarda um booleano
    // por URL, não um contador: como as três batem em DEV_CONFIG, a primeira a
    // responder zeraria o esqueleto com as outras ainda em voo. A conexão tem o
    // esqueleto próprio do card, e o status dos tenants é acessório da tabela.
    this.carregarConexao(true);
    this.carregarProvisionamentos();
    this.carregarStatusDosTenants();
  }

  /**
   * Descobre quais tenants estão habilitados. Sem isso a tabela não teria como
   * saber o rótulo do botão, já que o provisionamento não guarda esse estado.
   */
  private carregarStatusDosTenants(): void {
    this.apiVercelService.getEnvironments(true).subscribe({
      next: ({ data }) => {
        this.tenantsHabilitados = new Set(
          (data?.environments ?? [])
            .filter(item => item.habilitado)
            .map(item => item.tenant)
        );
      },
      // Silencioso de propósito: é informação acessória da tabela, e um alerta
      // aqui competiria com os erros do provisionamento, que importam mais.
      error: () => {
        this.tenantsHabilitados = new Set();
      },
    });
  }

  public estaHabilitado(item: IProvisionamentoResumo): boolean {
    return this.tenantsHabilitados.has(item.tenant);
  }

  /// CONEXÃO COM O GOOGLE ///

  public get conectado(): boolean {
    return (
      !!this.conexao?.conectado &&
      this.conexao.statusConexao !== EStatusConexaoGoogle.EXPIRADA
    );
  }

  public get conexaoExpirada(): boolean {
    return (
      !!this.conexao?.conectado &&
      this.conexao.statusConexao === EStatusConexaoGoogle.EXPIRADA
    );
  }

  /**
   * O callback do OAuth devolve o navegador para cá com o resultado na query.
   * Depois de exibi-lo, limpamos os parâmetros para um F5 não repetir o alerta.
   */
  private tratarRetornoDoGoogle(): void {
    const { conectado, erro, email } = this.route.snapshot.queryParams;

    if (!conectado && !erro) {
      return;
    }

    if (conectado === '1') {
      this.alertService.success(
        email
          ? `Conta ${email} conectada com sucesso.`
          : 'Conta Google conectada com sucesso.',
        'Sucesso'
      );
    } else {
      this.alertService.error(
        erro || 'Não foi possível conectar a conta Google.',
        'Erro'
      );
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  /**
   * Enquanto qualquer requisição de conexão está em voo, o card mostra
   * esqueleto no lugar dos botões — conectar ou desconectar sobre um estado
   * ainda desconhecido levaria a ações contraditórias.
   */
  public get conexaoOcupada(): boolean {
    return this.consultandoConexao || this.conectando || this.desconectando;
  }

  private carregarConexao(disabledLoading = false): void {
    this.consultandoConexao = true;

    this.apiVercelService.getStatusConexaoGoogle(disabledLoading).subscribe({
      next: ({ data }) => {
        this.conexao = data ?? { conectado: false };
        this.consultandoConexao = false;
      },
      error: error => {
        this.conexao = { conectado: false };
        this.consultandoConexao = false;
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível verificar a conexão com o Google',
          'Erro'
        );
      },
    });
  }

  public conectarGoogle(): void {
    this.conectando = true;

    this.apiVercelService.gerarUrlConexaoGoogle(true).subscribe({
      next: ({ data }) => {
        if (!data?.url) {
          this.conectando = false;
          this.alertService.error(
            'O backend não devolveu a URL de autorização.',
            'Erro'
          );
          return;
        }

        // Navegação de verdade, e não um XHR: quem precisa ver a tela de
        // consentimento do Google é o usuário.
        window.location.href = data.url;
      },
      error: error => {
        this.conectando = false;
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível iniciar a conexão com o Google',
          'Erro'
        );
      },
    });
  }

  public abrirConfirmacaoDesconexao(): void {
    this.confirmandoDesconexao = true;
  }

  public fecharConfirmacaoDesconexao(): void {
    this.confirmandoDesconexao = false;
  }

  public desconectarGoogle(): void {
    this.desconectando = true;

    this.apiVercelService.desconectarGoogle(true).subscribe({
      next: ({ message }) => {
        this.conexao = { conectado: false };
        this.desconectando = false;
        this.fecharConfirmacaoDesconexao();
        this.alertService.success(message || 'Conta desconectada', 'Sucesso');
      },
      error: error => {
        this.desconectando = false;
        this.fecharConfirmacaoDesconexao();
        this.alertService.error(
          error?.error || error?.message || 'Não foi possível desconectar',
          'Erro'
        );
      },
    });
  }

  /// FIM - CONEXÃO COM O GOOGLE ///

  /// FORMULÁRIO ///

  public get tenant() {
    return this.form.get('tenant');
  }

  public get projectId() {
    return this.form.get('projectId');
  }

  public get displayName() {
    return this.form.get('displayName');
  }

  public get adminEmail() {
    return this.form.get('adminEmail');
  }

  public get adminSenha() {
    return this.form.get('adminSenha');
  }

  public onTenantChange(): void {
    const tenant = (this.tenant?.value ?? '').trim().toLowerCase();

    if (!this.projectIdEditadoManualmente) {
      this.projectId?.setValue(this.derivarProjectId(tenant));
    }

    if (!this.form.get('displayName')?.dirty) {
      this.form.get('displayName')?.setValue(tenant);
    }
  }

  public onProjectIdChange(): void {
    this.projectIdEditadoManualmente = true;
  }

  /**
   * Espelha derivarProjectId de lib/helper/google-cloud.helper.ts para o campo
   * já nascer preenchido. O backend valida de novo — aqui é conveniência, não
   * a fonte da verdade.
   */
  private derivarProjectId(tenant: string): string {
    const base = tenant
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');

    if (!base) {
      return '';
    }

    const comLetraInicial = /^[a-z]/.test(base) ? base : `fw-${base}`;
    const truncado = comLetraInicial.slice(0, 30).replace(/-+$/, '');

    return truncado.length >= 6 ? truncado : `${truncado}-fitware`.slice(0, 30);
  }

  /// FIM - FORMULÁRIO ///

  /// PROVISIONAMENTO ///

  private carregarProvisionamentos(disabledLoading = false): void {
    this.apiVercelService.getProvisionamentos(disabledLoading).subscribe({
      next: ({ data }) => {
        this.provisionamentos = data?.provisionamentos ?? [];
        this.aplicarFiltro();
        this.etapas = data?.etapas ?? [];
        this.locaisRtdb = data?.locaisRtdb ?? [];

        if (
          this.locaisRtdb.length &&
          !this.locaisRtdb.includes(this.form.get('locationId')?.value)
        ) {
          this.form.get('locationId')?.setValue(this.locaisRtdb[0]);
        }

        // Mantém o modal de timeline em dia quando a lista é recarregada.
        if (this.provisionamentoAberto) {
          const atualizado = this.provisionamentos.find(
            item => item.tenant === this.provisionamentoAberto?.tenant
          );

          if (atualizado) {
            this.provisionamentoAberto = atualizado;
          }
        }
      },
      error: error => {
        this.alertService.error(
          error?.error ||
            error?.message ||
            'Não foi possível carregar os provisionamentos',
          'Erro'
        );
      },
    });
  }

  public abrirFormulario(): void {
    this.projectIdEditadoManualmente = false;
    this.form.reset({
      tenant: '',
      projectId: '',
      displayName: '',
      locationId: this.locaisRtdb[0] ?? 'us-central1',
      nomeEmpresa: '',
      adminNome: '',
      adminEmail: '',
      adminSenha: '',
    });
    this.mostrarFormulario = true;
  }

  public fecharFormulario(): void {
    this.mostrarFormulario = false;
  }

  public get podeIniciar(): boolean {
    return this.conectado && this.form.valid && !this.executando;
  }

  public iniciar(): void {
    if (!this.conectado) {
      this.alertService.error(
        'Conecte uma conta Google antes de criar o projeto.',
        'Erro'
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    this.executando = true;

    this.apiVercelService
      .iniciarProvisionamento({
        tenant: valores.tenant.trim().toLowerCase(),
        projectId: valores.projectId.trim().toLowerCase(),
        displayName: valores.displayName,
        locationId: valores.locationId,
        nomeEmpresa: valores.nomeEmpresa,
        adminNome: valores.adminNome,
        adminEmail: valores.adminEmail,
      })
      .subscribe({
        next: ({ data }) => {
          const provisionamento = data?.provisionamento ?? null;

          // A senha sai do formulário para a memória da tela: o formulário é
          // fechado agora, mas o laço ainda vai precisar dela na última etapa.
          this.senhaRetomada = valores.adminSenha ?? '';

          this.fecharFormulario();
          this.provisionamentoAberto = provisionamento;
          this.tenantEmExecucao = provisionamento?.tenant ?? null;

          // Entra na tabela já no início. Sem isto, fechar a timeline deixava
          // a tela sem nenhuma linha para reabrir — a criação existia só
          // dentro do modal.
          this.registrarNaLista(provisionamento);

          this.etapasExecutadasNestaSessao = 0;
          this.executarProximaEtapa();
        },
        error: error => {
          this.executando = false;
          this.alertService.error(
            error?.error ||
              error?.message ||
              'Não foi possível iniciar o provisionamento',
            'Erro'
          );
        },
      });
  }

  public tentarNovamente(): void {
    if (!this.provisionamentoAberto || this.executando) {
      return;
    }

    this.tenantEmExecucao = this.provisionamentoAberto.tenant;
    this.executando = true;
    this.etapasExecutadasNestaSessao = 0;
    this.executarProximaEtapa();
  }

  /** Verdadeiro só quando o laço está processando o item aberto no modal. */
  public get executandoAberto(): boolean {
    return (
      this.executando &&
      this.tenantEmExecucao === this.provisionamentoAberto?.tenant
    );
  }

  public get aguardandoPropagacao(): boolean {
    return !!this.provisionamentoAberto?.aguardandoPropagacao;
  }

  public get tentativasEtapaAtual(): number {
    return this.provisionamentoAberto?.tentativasEtapaAtual ?? 0;
  }

  public get aguardandoAcaoManual(): boolean {
    return (
      this.provisionamentoAberto?.status ===
      EStatusProvisionamento.AGUARDANDO_MANUAL
    );
  }

  /**
   * A senha só é pedida quando a etapa pendente é a de semear dados — a única
   * que a consome. Nas demais, retomar não precisa de nada além do clique.
   */
  public get precisaSenhaParaRetomar(): boolean {
    return (
      this.provisionamentoAberto?.etapaAtual ===
        EEtapaProvisionamento.SEMEAR_DADOS && !this.senhaRetomada
    );
  }

  public get podeRetomar(): boolean {
    if (this.executando) {
      return false;
    }

    return !this.precisaSenhaParaRetomar;
  }

  /**
   * "Já habilitei — continuar" é a mesma chamada de sempre: a etapa que pediu
   * a ação manual é reexecutada, e agora que a configuração existe no Google
   * ela passa. Ou seja, a verificação é objetiva — não confiamos na palavra de
   * quem clicou.
   */
  public continuarAposAcaoManual(): void {
    this.tentarNovamente();
  }

  /**
   * Dispara as etapas em sequência. Cada resposta já traz o histórico
   * atualizado, então a timeline se preenche sozinha conforme o loop avança.
   *
   * `disabledLoading` fica ligado para o skeleton da página não piscar a cada
   * etapa — o progresso da timeline é o feedback aqui.
   */
  private executarProximaEtapa(): void {
    const tenant = this.tenantEmExecucao;

    if (!tenant) {
      this.executando = false;
      return;
    }

    if (++this.etapasExecutadasNestaSessao > this.LIMITE_ETAPAS_POR_SESSAO) {
      this.executando = false;
      this.alertService.error(
        'O provisionamento executou etapas demais sem concluir. Recarregue a página e verifique o estado antes de continuar.',
        'Erro'
      );
      return;
    }

    this.apiVercelService
      .executarEtapaProvisionamento({
        tenant,
        // A senha só é consumida na última etapa e nunca é persistida no
        // backend, por isso reenviamos a cada chamada.
        adminSenha: this.senhaRetomada,
        disabledLoading: true,
      })
      .subscribe({
        next: ({ data }) => {
          const provisionamento = data?.provisionamento ?? null;

          // Só reflete no modal se ele estiver mostrando este mesmo tenant —
          // o usuário pode ter aberto a timeline de outra criação no meio.
          if (
            provisionamento &&
            this.provisionamentoAberto?.tenant === provisionamento.tenant
          ) {
            this.provisionamentoAberto = provisionamento;
          }

          // Mantém a linha da tabela viva durante a execução: o selo de status
          // acompanha, mesmo com a timeline fechada.
          this.registrarNaLista(provisionamento);

          if (!provisionamento) {
            this.executando = false;
            return;
          }

          if (provisionamento.status === EStatusProvisionamento.EM_ANDAMENTO) {
            // Quando o backend sinaliza propagação, a MESMA etapa será refeita
            // — esperar mais aqui é justamente o que dá tempo ao Google.
            const pausa = provisionamento.aguardandoPropagacao
              ? Math.min(
                  this.PAUSA_PROPAGACAO_MS *
                    (provisionamento.tentativasEtapaAtual ?? 1),
                  this.PAUSA_PROPAGACAO_MAXIMA_MS
                )
              : this.PAUSA_ENTRE_ETAPAS_MS;

            setTimeout(() => this.executarProximaEtapa(), pausa);
            return;
          }

          this.executando = false;
          this.carregarProvisionamentos(true);

          if (provisionamento.status === EStatusProvisionamento.CONCLUIDO) {
            this.alertService.success(
              `Tenant "${provisionamento.tenant}" criado e registrado com sucesso.`,
              'Sucesso'
            );
            return;
          }

          // Pausa esperada, não falha: o Google não deixa habilitar o
          // Authentication por API no plano Spark.
          if (
            provisionamento.status === EStatusProvisionamento.AGUARDANDO_MANUAL
          ) {
            this.alertService.warning(
              provisionamento.acaoManual?.titulo ??
                'O provisionamento precisa de uma ação no console do Google.',
              'Ação necessária'
            );
            return;
          }

          this.alertService.error(
            provisionamento.erro ||
              'Uma etapa falhou. Veja os detalhes na timeline.',
            'Erro'
          );
        },
        error: error => {
          this.executando = false;
          this.alertService.error(
            error?.error ||
              error?.message ||
              'Falha de comunicação ao executar a etapa',
            'Erro'
          );
        },
      });
  }

  /// FIM - PROVISIONAMENTO ///

  /// TIMELINE E HISTÓRICO ///

  /**
   * Busca por tenant, ID do projeto, nome exibido ou empresa — são os quatro
   * campos pelos quais se costuma lembrar de uma criação antiga.
   */
  public aplicarFiltro(): void {
    const termo = normalizarTexto(this.filtro);

    if (!termo) {
      this.provisionamentosFiltrados = [...this.provisionamentos];
      return;
    }

    this.provisionamentosFiltrados = this.provisionamentos.filter(item =>
      [item.tenant, item.projectId, item.displayName, item.nomeEmpresa].some(
        campo => normalizarTexto(campo ?? '').includes(termo)
      )
    );
  }

  /**
   * Insere ou atualiza um provisionamento na lista local, sem ir ao servidor.
   * É o que mantém a tabela em dia enquanto as etapas correm.
   */
  private registrarNaLista(item: IProvisionamentoResumo | null): void {
    if (!item) {
      return;
    }

    const indice = this.provisionamentos.findIndex(
      atual => atual.tenant === item.tenant
    );

    if (indice >= 0) {
      this.provisionamentos[indice] = item;
    } else {
      // A listagem vem do mais recente para o mais antigo.
      this.provisionamentos = [item, ...this.provisionamentos];
    }

    this.aplicarFiltro();
  }

  /**
   * Criação que ainda pede atenção: em andamento, com erro ou aguardando ação
   * manual. Alimenta o aviso acima da tabela, que é o caminho de volta para a
   * timeline depois de fechá-la.
   *
   * Prioriza a que está executando nesta sessão; se não houver, pega a
   * pendente mais recente — assim o aviso também aparece depois de um F5.
   */
  public get provisionamentoPendente(): IProvisionamentoResumo | null {
    const emExecucao = this.tenantEmExecucao
      ? this.provisionamentos.find(
          item => item.tenant === this.tenantEmExecucao
        )
      : undefined;

    if (emExecucao && emExecucao.status !== EStatusProvisionamento.CONCLUIDO) {
      return emExecucao;
    }

    return (
      this.provisionamentos.find(
        item => item.status !== EStatusProvisionamento.CONCLUIDO
      ) ?? null
    );
  }

  public etapasConcluidas(item: IProvisionamentoResumo): number {
    return item.etapasConcluidas.length;
  }

  public get totalEtapas(): number {
    return this.etapas.length;
  }

  public abrirTimeline(item: IProvisionamentoResumo): void {
    this.provisionamentoAberto = item;

    // Abrir a timeline de outra criação não pode herdar a senha digitada para
    // a criação anterior.
    if (this.tenantEmExecucao !== item.tenant) {
      this.senhaRetomada = '';
    }
  }

  public fecharTimeline(): void {
    // Fechar não cancela nada: o laço segue no tenant que estava executando, e
    // a linha da tabela continua mostrando o andamento.
    this.provisionamentoAberto = null;
  }

  public etapaEmAndamento(
    item: IProvisionamentoResumo | null
  ): EEtapaProvisionamento | null {
    if (!item || item.status !== EStatusProvisionamento.EM_ANDAMENTO) {
      return null;
    }

    return item.etapaAtual;
  }

  /// HABILITAR E DESABILITAR ///

  public abrirAlternarStatus(item: IProvisionamentoResumo): void {
    this.provisionamentoParaAlternar = item;
  }

  public fecharAlternarStatus(): void {
    this.provisionamentoParaAlternar = null;
  }

  public confirmarAlternarStatus(): void {
    const item = this.provisionamentoParaAlternar;

    if (!item) {
      return;
    }

    const habilitar = !this.estaHabilitado(item);
    this.alternandoStatus = true;

    this.apiVercelService
      .alternarStatusEnvironment({ tenant: item.tenant, habilitar })
      .subscribe({
        next: ({ message }) => {
          this.alternandoStatus = false;
          this.fecharAlternarStatus();
          this.alertService.success(message || 'Status alterado', 'Sucesso');
          this.carregarStatusDosTenants();
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
          // Recarrega mesmo no erro: a recusa costuma ser "já está nesse
          // estado", e aí a tabela é que estava desatualizada.
          this.carregarStatusDosTenants();
        },
      });
  }

  public abrirDescarte(item: IProvisionamentoResumo): void {
    this.provisionamentoParaDescartar = item;
  }

  public fecharDescarte(): void {
    this.provisionamentoParaDescartar = null;
  }

  public confirmarDescarte(): void {
    const item = this.provisionamentoParaDescartar;

    if (!item) {
      return;
    }

    this.descartando = true;

    this.apiVercelService
      .descartarProvisionamento({ tenant: item.tenant })
      .subscribe({
        next: ({ message }) => {
          this.descartando = false;
          this.fecharDescarte();

          if (this.provisionamentoAberto?.tenant === item.tenant) {
            this.provisionamentoAberto = null;
          }

          if (this.tenantEmExecucao === item.tenant) {
            this.tenantEmExecucao = null;
          }

          this.alertService.success(
            message || 'Registro descartado',
            'Sucesso'
          );
          this.carregarProvisionamentos(true);
        },
        error: error => {
          this.descartando = false;
          this.alertService.error(
            error?.error || error?.message || 'Não foi possível descartar',
            'Erro'
          );
        },
      });
  }

  /// FIM - HISTÓRICO ///
}
