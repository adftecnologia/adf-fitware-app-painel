import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FirebaseError } from '@angular/fire/app';
import {
    FormBuilder,
    FormGroup,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxMaskDirective } from 'ngx-mask';
import { NgxPaginationModule } from 'ngx-pagination';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EUnidadeProduto } from '../../shared/enums/sistema.enum';
import {
    IEscola,
    IEstoqueItem,
    IEstoqueLancamento,
    IProduto,
    IRefeicao,
    IRefeicaoItem,
    TPeriodoRefeicao,
} from '../../shared/models/sistema.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { AuthService } from '../../shared/services/auth-service/auth.service';
import { DataService } from '../../shared/services/data-service/data.service';
import { FeatureToggleService } from '../../shared/services/featuretoggle-service/featuretoggle.service';
import { DataValidators } from '../../shared/validators/data/data.validators';

declare var bootstrap: any;

@Component({
  selector: 'app-escolas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxPaginationModule,
    NgxMaskDirective,
    NgSelectModule,
  ],
  templateUrl: './escolas.component.html',
  styleUrl: './escolas.component.css',
})
export class EscolasComponent implements OnInit, OnDestroy {
  public readonly itensPorPagina = 10;

  public escolas: IEscola[] = [];
  public escolasFiltradas: IEscola[] = [];

  public escolaForm!: FormGroup;
  public escolaEditando: IEscola | null = null;
  public escolaParaExcluir: IEscola | null = null;

  public filtro = '';
  public filtroStatus = '';
  public filtroDataInicio = '';
  public filtroDataFim = '';
  public statusOptions = ['Ativo', 'Inativo'];
  public salvando = false;
  public excluindo = false;
  public totalEscolas = 0;
  public page = 1;
  // Produtos / Estoque
  public produtos: IProduto[] = [];
  public produtosFiltrados: IProduto[] = [];
  public produtoBusca = '';
  public estoqueBusca = '';
  public estoque: IEstoqueItem[] = [];
  public produtoSelecionadoId: string | null = null;
  public novoQtd = 0;
  public novoQtdMinima = 0;
  public novaUnidade: EUnidadeProduto | '' = '';
  public unidadeOptions = Object.values(EUnidadeProduto);
  public lancamentosEstoque: IEstoqueLancamento[] = [];
  public lancamentoProdutoSelecionadoId: string | null = null;
  public lancamentoQuantidade = 0;
  public lancamentoUnidade: EUnidadeProduto | '' = '';
  public lancamentoTipo: 'Entrada' | 'Saída' = 'Entrada';
  public lancamentoObservacao = '';
  // Refeições
  public refeicoes: IRefeicao[] = [];
  public refeicaoEditandoId: string | null = null;
  public refeicaoPeriodo: TPeriodoRefeicao = 'Café da manhã';
  public refeicaoDataServida = this.getDataAtual();
  public refeicaoQuantidadePorcoes = 1;
  public refeicaoItens: IRefeicaoItem[] = [];
  public refeicaoProdutoId: string | null = null;
  public refeicaoQuantidade = 0;
  public refeicaoUnidade: EUnidadeProduto | '' = '';
  public readonly periodoRefeicaoOptions: TPeriodoRefeicao[] = [
    'Café da manhã',
    'Almoço',
    'Café da tarde',
  ];

  public get mostrarAbaRefeicoes(): boolean {
    return environment.stage === 'LOCAL';
  }

  public podeSalvarEstoque(): boolean {
    const selectedId = this.getProdutoSelecionadoId();
    const qtdValue = Number(this.novoQtd);
    const qtdMinimaValue = Number(this.novoQtdMinima);

    return (
      Boolean(selectedId.trim()) &&
      Boolean(this.novaUnidade) &&
      Number.isFinite(qtdValue) &&
      qtdValue >= 0 &&
      Number.isFinite(qtdMinimaValue) &&
      qtdMinimaValue >= 0
    );
  }

  private subscriptions: Subscription[] = [];
  private deleteModalInstance: any;

  constructor(
    private readonly dataService: DataService,
    private readonly fb: FormBuilder,
    private readonly alertService: AlertService,
    public readonly featureToggleService: FeatureToggleService,
    private readonly authService: AuthService
  ) {}

  public ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initForm(): void {
    this.escolaForm = this.fb.group(
      {
        nome: ['', [Validators.required, Validators.minLength(2)]],
        status: [''],
        contato: [''],
        email: [''],
        rua: [''],
        bairro: [''],
        numero: [''],
        cep: [''],
        cidade: [''],
        estado: [''],
        qtdAlunos: [0],
        dataInicioContrato: [''],
        dataFimContrato: [''],
        valorCafeManha: [0, [Validators.min(0)]],
        valorAlmoco: [0, [Validators.min(0)]],
        valorCafeTarde: [0, [Validators.min(0)]],
      },
      {
        validators: DataValidators.intervaloContratoValido(),
      }
    );
  }

  private loadData(): void {
    const escolasSub = this.dataService.getEscolas.subscribe(escolas => {
      this.escolas = escolas;
      this.totalEscolas = escolas.length;
      this.aplicarFiltro();
    });

    const produtosSub = this.dataService.getProdutos.subscribe(produtos => {
      this.produtos = produtos;
      this.produtosFiltrados = produtos;
    });

    this.subscriptions.push(produtosSub);

    this.subscriptions.push(escolasSub);
  }

  public aplicarFiltro(): void {
    const filtroLower = this.filtro.trim().toLowerCase();
    const filtrarStatus = this.filtroStatus.trim();
    const dataInicio = this.filtroDataInicio
      ? new Date(this.filtroDataInicio)
      : null;
    const dataFim = this.filtroDataFim ? new Date(this.filtroDataFim) : null;

    this.escolasFiltradas = this.escolas.filter(escola => {
      let matches = true;

      if (filtroLower) {
        matches =
          escola.nome.toLowerCase().includes(filtroLower) ||
          escola.contato.toLowerCase().includes(filtroLower) ||
          escola.email.toLowerCase().includes(filtroLower) ||
          escola.rua.toLowerCase().includes(filtroLower) ||
          escola.bairro.toLowerCase().includes(filtroLower) ||
          escola.cidade.toLowerCase().includes(filtroLower) ||
          escola.estado.toLowerCase().includes(filtroLower);
      }

      if (filtrarStatus) {
        matches = matches && escola.status === filtrarStatus;
      }

      if (dataInicio && escola.dataInicioContrato) {
        const escolaDataInicio = new Date(escola.dataInicioContrato);
        matches = matches && escolaDataInicio >= dataInicio;
      }

      if (dataFim && escola.dataFimContrato) {
        const escolaDataFim = new Date(escola.dataFimContrato);
        matches = matches && escolaDataFim <= dataFim;
      }

      return matches;
    });
    this.page = 1; // Resetar para a primeira página ao aplicar filtro
  }

  public limparFiltro(): void {
    this.filtro = '';
    this.filtroStatus = '';
    this.filtroDataInicio = '';
    this.filtroDataFim = '';
    this.aplicarFiltro();
  }

  // Estoque / Produtos
  public filtrarProdutos(): void {
    const busca = (this.produtoBusca || '').trim().toLowerCase();
    if (!busca) {
      this.produtosFiltrados = this.produtos.slice();
      return;
    }

    this.produtosFiltrados = this.produtos.filter(p =>
      p.descricao.toLowerCase().includes(busca)
    );
  }

  public get estoqueFiltrado(): IEstoqueItem[] {
    const busca = (this.estoqueBusca || '').trim().toLowerCase();

    if (!busca) {
      return this.estoque;
    }

    return this.estoque.filter(item =>
      item.descricao.toLowerCase().includes(busca)
    );
  }

  private getProdutoSelecionadoId(): string {
    return typeof this.produtoSelecionadoId === 'string'
      ? this.produtoSelecionadoId
      : ((this.produtoSelecionadoId as any)?.id ?? '');
  }

  private atualizarEstoqueNaEscola(): void {
    if (!this.escolaEditando?.id) {
      return;
    }

    this.estoque = [...this.estoque];
  }

  private async salvarEstoqueNaEscola(): Promise<void> {
    if (!this.escolaEditando?.id) {
      this.alertService.warning(
        'Salve primeiro os dados da escola para registrar o estoque.',
        'Aviso'
      );
      return;
    }

    await this.dataService.updateEscola(this.escolaEditando.id, {
      estoque: this.estoque,
      lancamentosEstoque: this.lancamentosEstoque,
    });
  }

  public selecionarProdutoRefeicao(): void {
    const produto = this.produtos.find(p => p.id === this.refeicaoProdutoId);
    this.refeicaoUnidade = produto?.unidade ?? '';
  }

  public adicionarItemRefeicao(): void {
    const produto = this.produtos.find(p => p.id === this.refeicaoProdutoId);
    const quantidade = Number(this.refeicaoQuantidade);

    if (!produto || !Number.isFinite(quantidade) || quantidade <= 0 || !this.refeicaoUnidade) {
      this.alertService.warning('Selecione um produto e informe quantidade e unidade válidas.', 'Aviso');
      return;
    }

    const itemExistente = this.refeicaoItens.find(item => item.produtoId === produto.id);
    if (itemExistente) {
      itemExistente.quantidade += quantidade;
      itemExistente.unidade = this.refeicaoUnidade as EUnidadeProduto;
      this.refeicaoItens = [...this.refeicaoItens];
    } else {
      this.refeicaoItens = [
        ...this.refeicaoItens,
        { produtoId: produto.id!, descricao: produto.descricao, quantidade, unidade: this.refeicaoUnidade as EUnidadeProduto },
      ];
    }
    this.refeicaoProdutoId = null;
    this.refeicaoQuantidade = 0;
    this.refeicaoUnidade = '';
  }

  public removerItemRefeicao(produtoId: string): void {
    this.refeicaoItens = this.refeicaoItens.filter(item => item.produtoId !== produtoId);
  }

  public getValorItemRefeicao(item: IRefeicaoItem): number {
    return Number(item.quantidade || 0) * Number(this.produtos.find(p => p.id === item.produtoId)?.valor || 0);
  }

  public getValorTotalRefeicao(itens: IRefeicaoItem[] = this.refeicaoItens): number {
    return itens.reduce((total, item) => total + this.getValorItemRefeicao(item), 0);
  }

  public getValorPorPorcao(refeicao: Pick<IRefeicao, 'itens' | 'quantidadePorcoes'>): number {
    const porcoes = Number(refeicao.quantidadePorcoes);
    return porcoes > 0 ? this.getValorTotalRefeicao(refeicao.itens) / porcoes : 0;
  }

  public salvarRefeicao(): void {
    if (!this.escolaEditando?.id) {
      this.alertService.warning('Salve primeiro os dados da escola para registrar refeições.', 'Aviso');
      return;
    }
    if (!this.refeicaoDataServida || !Number.isFinite(Number(this.refeicaoQuantidadePorcoes)) || Number(this.refeicaoQuantidadePorcoes) <= 0 || this.refeicaoItens.length === 0) {
      this.alertService.warning('Informe a data, a quantidade de porções e ao menos um produto.', 'Aviso');
      return;
    }

    const refeicao: IRefeicao = {
      id: this.refeicaoEditandoId ?? this.criarIdRefeicao(),
      periodo: this.refeicaoPeriodo,
      dataServida: this.refeicaoDataServida,
      quantidadePorcoes: Number(this.refeicaoQuantidadePorcoes),
      itens: this.refeicaoItens.map(item => ({ ...item, quantidade: Number(item.quantidade) })),
    };
    this.refeicoes = this.refeicaoEditandoId
      ? this.refeicoes.map(item => item.id === this.refeicaoEditandoId ? refeicao : item)
      : [refeicao, ...this.refeicoes];

    this.dataService.updateEscola(this.escolaEditando.id, { refeicoes: this.refeicoes })
      .then(() => {
        this.alertService.success('Refeição salva com sucesso.', 'Sucesso');
        this.resetarFormRefeicao();
      })
      .catch(error => {
        console.error(error);
        this.alertService.error('Erro ao salvar a refeição.');
      });
  }

  public editarRefeicao(refeicao: IRefeicao): void {
    this.refeicaoEditandoId = refeicao.id;
    this.refeicaoPeriodo = refeicao.periodo;
    this.refeicaoDataServida = refeicao.dataServida;
    this.refeicaoQuantidadePorcoes = refeicao.quantidadePorcoes;
    this.refeicaoItens = refeicao.itens.map(item => ({ ...item }));
  }

  public excluirRefeicao(id: string): void {
    if (!this.escolaEditando?.id) return;
    this.refeicoes = this.refeicoes.filter(refeicao => refeicao.id !== id);
    this.dataService.updateEscola(this.escolaEditando.id, { refeicoes: this.refeicoes })
      .then(() => {
        this.alertService.success('Refeição excluída com sucesso.', 'Sucesso');
        if (this.refeicaoEditandoId === id) this.resetarFormRefeicao();
      })
      .catch(error => {
        console.error(error);
        this.alertService.error('Erro ao excluir a refeição.');
      });
  }

  public cancelarEdicaoRefeicao(): void {
    this.resetarFormRefeicao();
  }

  public selecionarProduto(): void {
    const selectedId = this.getProdutoSelecionadoId();
    this.produtoSelecionadoId = selectedId;

    const prod = this.produtos.find(p => p.id === selectedId);
    if (prod) {
      const itemExistente = this.estoque.find(
        item => item.produtoId === selectedId
      );
      this.novoQtd = itemExistente?.quantidade ?? 0;
      this.novoQtdMinima = itemExistente?.quantidadeMinima ?? 0;
      this.novaUnidade = itemExistente?.unidade ?? prod.unidade ?? EUnidadeProduto.UNIDADE;
    } else {
      this.novoQtd = 0;
      this.novoQtdMinima = 0;
      this.novaUnidade = '';
      this.produtoSelecionadoId = null;
    }
  }

  public async salvarProdutoSelecionado(): Promise<void> {
    const selectedId = this.getProdutoSelecionadoId();

    if (!this.podeSalvarEstoque()) {
      this.alertService.warning(
        'Selecione um produto e informe quantidades válidas.',
        'Aviso'
      );
      return;
    }

    const produtoBase = this.produtos.find(p => p.id === selectedId);

    if (!produtoBase) {
      this.alertService.warning(
        'Produto não encontrado na base de dados.',
        'Aviso'
      );
      return;
    }

    const itemExistente = this.estoque.find(
      item => item.produtoId === selectedId
    );

    if (itemExistente) {
      this.alertService.warning(
        'Insumo ja cadastro na escola, faça o lançamento na aba de lançamento de estoque',
        'Aviso'
      );
      return;
    }

    try {
      const novoItem: IEstoqueItem = {
        produtoId: selectedId,
        descricao: produtoBase.descricao,
        quantidade: Number(this.novoQtd),
        quantidadeMinima: Number(this.novoQtdMinima),
        unidade: this.novaUnidade as EUnidadeProduto,
      };

      this.estoque = [...this.estoque, novoItem];

      await this.salvarEstoqueNaEscola();
      this.alertService.success('Estoque atualizado na escola', 'Sucesso');
    } catch (err) {
      console.error(err);
      this.alertService.error('Erro ao atualizar estoque da escola');
    }
  }

  public selecionarProdutoLancamento(): void {
    const selectedId = this.lancamentoProdutoSelecionadoId ?? '';
    const produto = this.produtos.find(p => p.id === selectedId);

    if (produto) {
      this.lancamentoUnidade = produto.unidade ?? this.lancamentoUnidade;
    }
  }

  public async salvarLancamentoEstoque(): Promise<void> {
    if (!this.escolaEditando?.id) {
      this.alertService.warning(
        'Salve primeiro a escola para registrar lançamentos de estoque.',
        'Aviso'
      );
      return;
    }

    const selectedId = this.lancamentoProdutoSelecionadoId ?? '';
    const quantidade = Number(this.lancamentoQuantidade);

    if (!selectedId || !Number.isFinite(quantidade) || quantidade <= 0) {
      this.alertService.warning(
        'Selecione um produto e informe uma quantidade válida.',
        'Aviso'
      );
      return;
    }

    if (!this.lancamentoUnidade) {
      this.alertService.warning('Informe a unidade do lançamento.', 'Aviso');
      return;
    }

    const produtoBase = this.produtos.find(p => p.id === selectedId);
    if (!produtoBase) {
      this.alertService.warning('Produto não encontrado.', 'Aviso');
      return;
    }

    const itemExistente = this.estoque.find(item => item.produtoId === selectedId);
    const quantidadeAtual = itemExistente?.quantidade ?? 0;
    let novaQuantidade = quantidadeAtual;

    if (this.lancamentoTipo === 'Entrada') {
      novaQuantidade = quantidadeAtual + quantidade;
    } else {
      novaQuantidade = quantidadeAtual - quantidade;
      if (novaQuantidade < 0) {
        this.alertService.warning(
          'Não é possível registrar uma saída maior que o saldo atual.',
          'Aviso'
        );
        return;
      }
    }

    const novoItem: IEstoqueItem = {
      produtoId: selectedId,
      descricao: produtoBase.descricao,
      quantidade: novaQuantidade,
      quantidadeMinima: itemExistente?.quantidadeMinima ?? 0,
      unidade: this.lancamentoUnidade as EUnidadeProduto,
    };

    this.estoque = this.estoque.filter(item => item.produtoId !== selectedId);
    this.estoque = [...this.estoque, novoItem];

    const usuario = this.getUsuarioLogado();
    const lancamento: IEstoqueLancamento = {
      produtoId: selectedId,
      descricao: produtoBase.descricao,
      quantidade,
      unidade: this.lancamentoUnidade as EUnidadeProduto,
      tipo: this.lancamentoTipo,
      observacao: this.lancamentoObservacao?.trim() || undefined,
      usuarioId: usuario.usuarioId,
      usuarioNome: usuario.usuarioNome,
      dataHoraLancamento: new Date().toISOString(),
    };

    this.lancamentosEstoque = [lancamento, ...this.lancamentosEstoque];

    try {
      await this.salvarEstoqueNaEscola();
      this.alertService.success('Lançamento registrado com sucesso', 'Sucesso');
      this.resetarFormLancamentoEstoque();
    } catch (err) {
      console.error(err);
      this.alertService.error('Erro ao registrar lançamento de estoque');
    }
  }

  public async salvarProduto(prod: IEstoqueItem): Promise<void> {
    if (!prod?.produtoId) {
      this.alertService.warning('Selecione um produto válido.', 'Aviso');
      return;
    }

    try {
      this.estoque = this.estoque.map(item =>
        item.produtoId === prod.produtoId
          ? {
              ...item,
              quantidade: Number(prod.quantidade ?? 0),
              quantidadeMinima: Number(prod.quantidadeMinima ?? 0),
            }
          : item
      );

      await this.salvarEstoqueNaEscola();
      this.alertService.success('Estoque da escola atualizado', 'Sucesso');
    } catch (err) {
      console.error(err);
      this.alertService.error('Erro ao atualizar estoque da escola');
    }
  }

  public abrirModal(): void {
    this.escolaEditando = null;
    this.estoque = [];
    this.lancamentosEstoque = [];
    this.refeicoes = [];
    this.produtoSelecionadoId = null;
    this.novoQtd = 0;
    this.novoQtdMinima = 0;
    this.produtoBusca = '';
    this.resetarFormLancamentoEstoque();
    this.resetarFormRefeicao();
    this.produtosFiltrados = this.produtos.slice();
    this.escolaForm.reset();

    if (this.featureToggleService.isUsuarioVisualizador) {
      this.escolaForm.disable();
    } else {
      this.escolaForm.enable();
    }
  }

  public editarEscola(escola: IEscola): void {
    this.escolaEditando = escola;
    this.estoque = (escola as any).estoque ?? [];
    this.lancamentosEstoque = (escola as any).lancamentosEstoque ?? [];
    this.refeicoes = escola.refeicoes ?? [];
    this.produtoSelecionadoId = null;
    this.novoQtd = 0;
    this.novoQtdMinima = 0;
    this.novaUnidade = '';
    this.produtoBusca = '';
    this.resetarFormLancamentoEstoque();
    this.resetarFormRefeicao();
    this.estoqueBusca = '';
    this.produtosFiltrados = this.produtos.slice();
    this.escolaForm.patchValue({
      nome: escola.nome,
      status: escola.status,
      contato: escola.contato,
      email: escola.email,
      rua: escola.rua,
      bairro: escola.bairro,
      numero: escola.numero,
      cep: escola.cep,
      cidade: escola.cidade,
      estado: escola.estado,
      qtdAlunos: escola.qtdAlunos,
      dataInicioContrato: escola.dataInicioContrato,
      dataFimContrato: escola.dataFimContrato,
      valorCafeManha: escola.valorCafeManha ?? 0,
      valorAlmoco: escola.valorAlmoco ?? 0,
      valorCafeTarde: escola.valorCafeTarde ?? 0,
    });

    if (this.featureToggleService.isUsuarioVisualizador) {
      this.escolaForm.disable();
    } else {
      this.escolaForm.enable();
    }
  }

  public async salvarEscola(): Promise<void> {
    if (!this.escolaForm.valid) {
      Object.keys(this.escolaForm.controls).forEach(key => {
        this.escolaForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.salvando = true;

    const escolaData = {
      ...this.escolaForm.value,
      estoque: this.estoque,
      lancamentosEstoque: this.lancamentosEstoque,
      refeicoes: this.refeicoes,
    } as Omit<IEscola, 'id'>;

    const nomeExistente = this.escolas.find(
      escola =>
        escola.nome.toLowerCase() === escolaData.nome.toLowerCase() &&
        (!this.escolaEditando || escola.id !== this.escolaEditando.id)
    );

    if (nomeExistente) {
      this.alertService.warning(
        'Já existe uma escola com este nome! Por favor, escolha outro nome.',
        'Aviso'
      );
      this.salvando = false;
      return;
    }

    try {
      if (this.escolaEditando) {
        await this.dataService.updateEscola(
          this.escolaEditando.id!,
          escolaData
        );
      } else {
        await this.dataService.addEscola(escolaData);
      }

      this.fecharModal();
      this.escolaForm.reset();
      this.escolaEditando = null;
    } catch (error: FirebaseError | any) {
      this.alertService.error(
        'Ocorreu um erro ao salvar escola. Por favor, tente novamente.',
        'Aviso',
        {
          autoClose: false,
        }
      );
      console.error('Erro ao salvar escola:', error);
    } finally {
      this.salvando = false;
    }
  }

  public confirmarExclusao(escola: IEscola): void {
    this.escolaParaExcluir = escola;
    this.deleteModalInstance = new bootstrap.Modal(
      document.getElementById('confirmDeleteModal')
    );
    this.deleteModalInstance.show();
  }

  public async excluirEscola(): Promise<void> {
    if (this.escolaParaExcluir) {
      this.excluindo = true;

      try {
        await this.dataService.deleteEscola(this.escolaParaExcluir.id!);
        this.fecharModalExclusao();
        this.escolaParaExcluir = null;
      } catch (error: FirebaseError | any) {
        this.alertService.error(
          'Erro ao excluir escola. Por favor, tente novamente.',
          'Aviso',
          {
            autoClose: false,
          }
        );
        console.error('Erro ao excluir escola:', error);
      } finally {
        this.excluindo = false;
      }
    }
  }

  private fecharModal(): void {
    const modalElement = document.getElementById('escolaModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
  }

  private fecharModalExclusao(): void {
    if (this.deleteModalInstance) {
      this.deleteModalInstance.hide();
    }
  }

  get nome() {
    return this.escolaForm.get('nome');
  }

  get status() {
    return this.escolaForm.get('status');
  }

  get contato() {
    return this.escolaForm.get('contato');
  }

  get email() {
    return this.escolaForm.get('email');
  }

  get rua() {
    return this.escolaForm.get('rua');
  }

  get bairro() {
    return this.escolaForm.get('bairro');
  }

  get numero() {
    return this.escolaForm.get('numero');
  }

  get cep() {
    return this.escolaForm.get('cep');
  }

  get cidade() {
    return this.escolaForm.get('cidade');
  }

  get estado() {
    return this.escolaForm.get('estado');
  }

  get dataInicioContrato() {
    return this.escolaForm.get('dataInicioContrato');
  }

  get dataFimContrato() {
    return this.escolaForm.get('dataFimContrato');
  }

  private resetarFormLancamentoEstoque(): void {
    this.lancamentoProdutoSelecionadoId = null;
    this.lancamentoQuantidade = 0;
    this.lancamentoUnidade = '';
    this.lancamentoTipo = 'Entrada';
    this.lancamentoObservacao = '';
  }

  private resetarFormRefeicao(): void {
    this.refeicaoEditandoId = null;
    this.refeicaoPeriodo = 'Café da manhã';
    this.refeicaoDataServida = this.getDataAtual();
    this.refeicaoQuantidadePorcoes = 1;
    this.refeicaoItens = [];
    this.refeicaoProdutoId = null;
    this.refeicaoQuantidade = 0;
    this.refeicaoUnidade = '';
  }

  private getDataAtual(): string {
    const agora = new Date();
    const offset = agora.getTimezoneOffset();
    return new Date(agora.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }

  private criarIdRefeicao(): string {
    return `refeicao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getUsuarioLogado(): { usuarioId: string; usuarioNome: string } {
    const currentUser = this.authService.getCurrentUser;
    const profile = this.authService.getUserProfile;

    return {
      usuarioId: currentUser?.uid ?? '',
      usuarioNome:
        profile?.name ||
        currentUser?.displayName ||
        currentUser?.email ||
        'Usuário não identificado',
    };
  }

  public getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  public getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      Ativo: 'badge-success',
      Inativo: 'badge-warning',
    };
    return `badge ${map[status] ?? 'badge-secondary'}`;
  }
}
