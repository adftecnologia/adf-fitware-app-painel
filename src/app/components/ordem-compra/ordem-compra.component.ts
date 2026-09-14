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
import { NgxPaginationModule } from 'ngx-pagination';
import { Subscription } from 'rxjs';
import { ActionsDropdownComponent } from '../../shared/components/actions-dropdown/actions-dropdown.component';
import {
  ECategoriaProduto,
  EStatusOrdemCompra,
  EUnidadeProduto,
} from '../../shared/enums/sistema.enum';
import {
  convertDatetimeToDate,
  gerarNumeroSequencialData,
} from '../../shared/functions/date.function';
import {
  getTwoLetterAcronym,
  normalizarTexto,
} from '../../shared/functions/sistema.function';
import { IActionDropdownItem } from '../../shared/models/actions-dropdown.model';
import {
  IFornecedor,
  IOrdemCompra,
  IOrdemCompraItem,
  IProduto,
} from '../../shared/models/sistema.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { DataService } from '../../shared/services/data-service/data.service';
import { FeatureToggleService } from '../../shared/services/featuretoggle-service/featuretoggle.service';
import { PdfMakeService } from '../../shared/services/pdf-make/pdf-make.service';

declare var bootstrap: any;

@Component({
  selector: 'app-ordem-compra',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxPaginationModule,
    NgSelectModule,
    ActionsDropdownComponent,
  ],
  templateUrl: './ordem-compra.component.html',
  styleUrl: './ordem-compra.component.css',
})
export class OrdemCompraComponent implements OnInit, OnDestroy {
  public readonly itensPorPagina = 10;

  public ordensCompra: IOrdemCompra[] = [];
  public ordensCompraFiltradas: IOrdemCompra[] = [];

  public ordemForm!: FormGroup;
  public ordemEditando: IOrdemCompra | null = null;
  public ordemParaExcluir: IOrdemCompra | null = null;
  public numeroOrdemAtual: number | null = null;

  // Itens em memória (antes de salvar)
  public itensCompra: IOrdemCompraItem[] = [];
  public itensBusca = '';

  // Dados para ng-select
  public produtos: IProduto[] = [];
  public fornecedores: IFornecedor[] = [];
  public readonly categoriaOptions = Object.values(ECategoriaProduto);
  public readonly unidadeOptions = Object.values(EUnidadeProduto);
  public readonly statusOptions = Object.values(EStatusOrdemCompra);

  // Campos do formulário de item (standalone ngModel)
  public itemFornecedorId: string | null = null;
  public itemProdutoId: string | null = null;
  public itemCategoriaId: string | null = null;
  public itemQuantidade: number | null = null;
  public itemUnidade: string | null = null;
  public itemObservacao = '';

  public filtro = '';
  public filtroStatus = '';
  public filtroDataInicio = '';
  public filtroDataFim = '';
  public salvando = false;
  public excluindo = false;
  public totalOrdens = 0;
  public page = 1;

  private subscriptions: Subscription[] = [];
  private deleteModalInstance: any;

  constructor(
    private readonly dataService: DataService,
    private readonly fb: FormBuilder,
    private readonly alertService: AlertService,
    private readonly pdfMakeService: PdfMakeService,
    public readonly featureToggleService: FeatureToggleService
  ) {}

  public ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initForm(): void {
    this.ordemForm = this.fb.group({
      descricao: ['', [Validators.required, Validators.minLength(2)]],
      status: [EStatusOrdemCompra.EMITIDA, [Validators.required]],
      observacao: [''],
    });
  }

  private loadData(): void {
    const ordemSub = this.dataService.getOrdemCompra.subscribe(ordens => {
      this.ordensCompra = ordens;
      this.totalOrdens = ordens.length;
      this.aplicarFiltro();
    });

    const produtosSub = this.dataService.getProdutos.subscribe(produtos => {
      this.produtos = produtos;
    });

    const fornecedoresSub = this.dataService.getFornecedores.subscribe(
      fornecedores => {
        this.fornecedores = fornecedores;
      }
    );

    this.subscriptions.push(ordemSub, produtosSub, fornecedoresSub);
  }

  public aplicarFiltro(): void {
    const filtroNormalizado = normalizarTexto(this.filtro);
    const dataInicio = this.filtroDataInicio
      ? new Date(`${this.filtroDataInicio}T00:00:00`)
      : null;
    const dataFim = this.filtroDataFim
      ? new Date(`${this.filtroDataFim}T23:59:59.999`)
      : null;

    this.ordensCompraFiltradas = this.ordensCompra.filter(ordem => {
      let matches = true;

      if (filtroNormalizado) {
        matches = normalizarTexto(ordem.descricao).includes(filtroNormalizado);
      }

      if (this.filtroStatus) {
        matches = matches && ordem.status === this.filtroStatus;
      }

      if (dataInicio && ordem.createdAt) {
        matches = matches && new Date(ordem.createdAt) >= dataInicio;
      }

      if (dataFim && ordem.createdAt) {
        matches = matches && new Date(ordem.createdAt) <= dataFim;
      }

      return matches;
    });
    this.page = 1;
  }

  public limparFiltro(): void {
    this.filtro = '';
    this.filtroStatus = '';
    this.filtroDataInicio = '';
    this.filtroDataFim = '';
    this.aplicarFiltro();
  }

  // --- Helpers para display ---

  public getNomeProduto(produtoId: string): string {
    return this.produtos.find(p => p.id === produtoId)?.descricao ?? '—';
  }

  public getNomeFornecedor(fornecedorId: string): string {
    return this.fornecedores.find(f => f.id === fornecedorId)?.nome ?? '—';
  }

  public get itensFiltrados(): IOrdemCompraItem[] {
    const busca = normalizarTexto(this.itensBusca);
    if (!busca) return this.itensCompra;
    return this.itensCompra.filter(item => {
      const prod = normalizarTexto(this.getNomeProduto(item.produtoId));
      const forn = normalizarTexto(this.getNomeFornecedor(item.fornecedorId));
      return prod.includes(busca) || forn.includes(busca);
    });
  }

  // --- Lógica de itens ---

  public onProdutoChange(): void {
    if (!this.itemProdutoId) {
      this.itemCategoriaId = null;
      return;
    }
    const prod = this.produtos.find(p => p.id === this.itemProdutoId);
    if (prod?.categoria) {
      this.itemCategoriaId = prod.categoria;
    }
  }

  public podeSalvarItem(): boolean {
    return (
      !!this.itemFornecedorId &&
      !!this.itemProdutoId &&
      !!this.itemCategoriaId &&
      this.itemQuantidade !== null &&
      Number(this.itemQuantidade) > 0
    );
  }

  public adicionarItem(): void {
    if (!this.podeSalvarItem()) {
      this.alertService.warning(
        'Preencha todos os campos obrigatórios do item.',
        'Aviso'
      );
      return;
    }

    const novoItem: IOrdemCompraItem = {
      fornecedorId: this.itemFornecedorId!,
      produtoId: this.itemProdutoId!,
      categoriaId: this.itemCategoriaId as ECategoriaProduto,
      quantidade: Number(this.itemQuantidade),
      unidade: (this.itemUnidade as EUnidadeProduto) || undefined,
      observacao: this.itemObservacao.trim() || undefined,
    };

    this.itensCompra = [...this.itensCompra, novoItem];
    this.resetarCamposItem();
  }

  public removerItem(index: number): void {
    this.itensCompra = this.itensCompra.filter((_, i) => i !== index);
    this.itemFornecedorId = this.itensCompra[0]?.fornecedorId ?? null;
  }

  public get fornecedorItemBloqueado(): boolean {
    return this.itensCompra.length > 0;
  }

  private resetarCamposItem(): void {
    this.itemFornecedorId = this.itensCompra[0]?.fornecedorId ?? null;
    this.itemProdutoId = null;
    this.itemCategoriaId = null;
    this.itemQuantidade = null;
    this.itemUnidade = null;
    this.itemObservacao = '';
  }

  // --- CRUD principal ---

  public abrirModal(): void {
    this.ordemEditando = null;
    this.numeroOrdemAtual = gerarNumeroSequencialData();
    this.itensCompra = [];
    this.itensBusca = '';
    this.resetarCamposItem();
    this.ordemForm.reset({ status: EStatusOrdemCompra.EMITIDA });

    if (this.featureToggleService.isUsuarioVisualizador) {
      this.ordemForm.disable();
    } else {
      this.ordemForm.enable();
    }
  }

  public editarOrdem(ordem: IOrdemCompra): void {
    this.ordemEditando = ordem;
    this.numeroOrdemAtual = ordem.numero;
    this.itensCompra = [...(ordem.itens ?? [])];
    this.itensBusca = '';
    this.resetarCamposItem();

    this.ordemForm.patchValue({
      descricao: ordem.descricao,
      status: ordem.status ?? EStatusOrdemCompra.EMITIDA,
      observacao: ordem.observacao ?? '',
    });

    if (this.featureToggleService.isUsuarioVisualizador) {
      this.ordemForm.disable();
    } else {
      this.ordemForm.enable();
    }
  }

  public async salvarOrdem(): Promise<void> {
    if (!this.ordemForm.valid) {
      Object.keys(this.ordemForm.controls).forEach(key =>
        this.ordemForm.get(key)?.markAsTouched()
      );
      return;
    }

    if (this.itensCompra.length === 0) {
      this.alertService.warning(
        'Adicione ao menos um item à ordem de compra.',
        'Aviso'
      );
      return;
    }

    this.salvando = true;

    const ordemData: Omit<IOrdemCompra, 'id'> = {
      ...this.ordemForm.value,
      numero: this.numeroOrdemAtual!,
      itens: this.itensCompra,
    };

    try {
      if (this.ordemEditando) {
        await this.dataService.updateOrdemCompra(
          this.ordemEditando.id!,
          ordemData
        );
      } else {
        await this.dataService.addOrdemCompra(ordemData);
      }

      this.fecharModal();
      this.ordemForm.reset();
      this.ordemEditando = null;
      this.numeroOrdemAtual = null;
      this.itensCompra = [];
    } catch (error: FirebaseError | any) {
      this.alertService.error(
        'Ocorreu um erro ao salvar a ordem de compra. Tente novamente.',
        'Aviso',
        { autoClose: false }
      );
      console.error('Erro ao salvar ordem de compra:', error);
    } finally {
      this.salvando = false;
    }
  }

  public confirmarExclusao(ordem: IOrdemCompra): void {
    this.ordemParaExcluir = ordem;
    this.deleteModalInstance = new bootstrap.Modal(
      document.getElementById('confirmDeleteModalOrdemCompra')
    );
    this.deleteModalInstance.show();
  }

  public async excluirOrdem(): Promise<void> {
    if (!this.ordemParaExcluir) return;
    this.excluindo = true;
    try {
      await this.dataService.deleteOrdemCompra(this.ordemParaExcluir.id!);
      this.fecharModalExclusao();
      this.ordemParaExcluir = null;
    } catch (error: FirebaseError | any) {
      this.alertService.error(
        'Erro ao excluir a ordem de compra. Tente novamente.',
        'Aviso',
        { autoClose: false }
      );
      console.error('Erro ao excluir ordem de compra:', error);
    } finally {
      this.excluindo = false;
    }
  }

  private fecharModal(): void {
    const modalElement = document.getElementById('ordemCompraModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) modal.hide();
    }
  }

  private fecharModalExclusao(): void {
    if (this.deleteModalInstance) {
      this.deleteModalInstance.hide();
    }
  }

  public getInitials(name: string): string {
    return getTwoLetterAcronym(name);
  }

  public getStatusOrdemBadgeClass(status: string): string {
    const map: Record<string, string> = {
      [EStatusOrdemCompra.EMITIDA]: 'badge-primary',
      [EStatusOrdemCompra.EM_PROCESSO]: 'badge-warning',
      [EStatusOrdemCompra.RECEBIDA]: 'badge-primary',
      [EStatusOrdemCompra.FINALIZADA]: 'badge-success',
      [EStatusOrdemCompra.PAGA]: 'badge-success',
      [EStatusOrdemCompra.CANCELADA]: 'badge-danger',
    };
    return `badge ${map[status] ?? 'badge-primary'}`;
  }

  public async exportarOrdem(ordem: IOrdemCompra): Promise<void> {
    await this.pdfMakeService.gerarRelatorioOrdemCompraModal(
      ordem,
      this.fornecedores,
      this.produtos
    );
  }

  public getAcoesOrdem(ordem: IOrdemCompra): IActionDropdownItem[] {
    return [
      {
        label: 'Copiar itens',
        icon: 'fa-copy',
        disabled: ordem.itens.length === 0,
        onClick: () => this.copiarItens(ordem.itens, ordem.descricao),
      },
      {
        label: 'Exportar PDF',
        icon: 'fa-file-pdf',
        disabled: ordem.itens.length === 0,
        onClick: () => this.exportarOrdem(ordem),
      },
      {
        label: this.featureToggleService.canCadastrar ? 'Editar' : 'Visualizar',
        icon: this.featureToggleService.canCadastrar ? 'fa-edit' : 'fa-eye',
        dataBsToggle: 'modal',
        dataBsTarget: '#ordemCompraModal',
        onClick: () => this.editarOrdem(ordem),
      },
      {
        label: 'Excluir',
        icon: 'fa-trash',
        textClass: 'text-danger',
        hidden: !this.featureToggleService.isUsuarioAdmin,
        onClick: () => this.confirmarExclusao(ordem),
      },
    ];
  }

  public async copiarItens(
    itens: IOrdemCompraItem[],
    descricao?: string
  ): Promise<void> {
    if (!itens.length) return;

    const cabecalho = [
      'Produto',
      'Fornecedor',
      'Categoria',
      'Quantidade',
      'Unidade',
      'Observação',
    ].join('\t');
    const linhas = itens.map(item =>
      [
        this.getNomeProduto(item.produtoId),
        this.getNomeFornecedor(item.fornecedorId),
        item.categoriaId,
        item.quantidade,
        item.unidade ?? '',
        item.observacao ?? '',
      ].join('\t')
    );

    const titulo = descricao ? `*${descricao}*\n` : '';
    const texto = titulo + cabecalho + '\n' + linhas.join('\n');

    try {
      await navigator.clipboard.writeText(texto);
      this.alertService.success(
        'Itens copiados para a área de transferência!',
        'Copiado'
      );
    } catch {
      this.alertService.error('Não foi possível copiar os itens.', 'Erro');
    }
  }

  public get descricao() {
    return this.ordemForm.get('descricao');
  }

  public get dataCriacaoLabel(): string {
    return convertDatetimeToDate(
      this.ordemEditando?.createdAt ?? new Date().toISOString()
    );
  }
}
