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
import { NgxMaskDirective } from 'ngx-mask';
import { NgxPaginationModule } from 'ngx-pagination';
import { Subscription } from 'rxjs';
import {
  EStatusFornecedor,
  EStatusOrdemCompra,
} from '../../shared/enums/sistema.enum';
import {
  convertSalaryToPtBrCurrency,
  getTwoLetterAcronym,
  normalizarTexto,
} from '../../shared/functions/sistema.function';
import {
  IFornecedor,
  IOrdemCompra,
  IProduto,
} from '../../shared/models/sistema.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { DataService } from '../../shared/services/data-service/data.service';
import { FeatureToggleService } from '../../shared/services/featuretoggle-service/featuretoggle.service';
import { CpfCnpjValidators } from './../../shared/validators/cpf-cnpj/cpf-cnpj.validators';
import { EmailValidators } from './../../shared/validators/email/email.validators';

declare var bootstrap: any;

@Component({
  selector: 'app-fornecedores',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxPaginationModule,
    NgxMaskDirective,
  ],
  templateUrl: './fornecedores.component.html',
  styleUrls: ['./fornecedores.component.css'],
})
export class FornecedoresComponent implements OnInit, OnDestroy {
  public readonly itensPorPagina: number = 10;

  public fornecedores: IFornecedor[] = [];
  public fornecedoresFiltrados: IFornecedor[] = [];

  public fornecedorForm!: FormGroup;
  public fornecedorEditando: IFornecedor | null = null;
  public fornecedorParaExcluir: IFornecedor | null = null;

  public filtro = '';
  public filtroStatus = '';
  public salvando = false;
  public excluindo = false;
  public totalFornecedores = 0;
  public page: number = 1;
  public readonly statusOptions = Object.values(EStatusFornecedor);

  // Aba de Ordens de Compra do fornecedor
  public readonly itensPorPaginaOrdens = 10;
  public ordensCompra: IOrdemCompra[] = [];
  public produtos: IProduto[] = [];
  public ordensCompraDoFornecedor: IOrdemCompra[] = [];
  public ordensCompraFiltradas: IOrdemCompra[] = [];
  public filtroOrdem = '';
  public filtroOrdemStatus = '';
  public filtroOrdemDataInicio = '';
  public filtroOrdemDataFim = '';
  public pageOrdens = 1;
  public readonly statusOrdemOptions = Object.values(EStatusOrdemCompra);

  private subscriptions: Subscription[] = [];
  private deleteModalInstance: any;

  constructor(
    private readonly dataService: DataService,
    private readonly fb: FormBuilder,
    private readonly alertService: AlertService,
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
    this.fornecedorForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      cpfCnpj: [
        '',
        [Validators.required, CpfCnpjValidators.cpfCnpjValidator()],
      ],
      status: [EStatusFornecedor.ATIVO, [Validators.required]],
      categoria: ['', [Validators.required]],
      telefone: [''],
      email: ['', [EmailValidators.emailValido()]],
      rua: [''],
      bairro: [''],
      numero: [''],
      cep: [''],
      cidade: [''],
      estado: [''],
      observacao: [''],
    });
  }

  private loadData(): void {
    // Carrega fornecedores
    const fornecedoresSub = this.dataService.getFornecedores.subscribe(
      fornecedores => {
        this.fornecedores = fornecedores;
        this.totalFornecedores = fornecedores.length;
        this.aplicarFiltro();
      }
    );

    const ordensCompraSub = this.dataService.getOrdemCompra.subscribe(
      ordensCompra => {
        this.ordensCompra = ordensCompra;
        this.filtrarOrdensDoFornecedor();
      }
    );

    const produtosSub = this.dataService.getProdutos.subscribe(produtos => {
      this.produtos = produtos;
    });

    this.subscriptions.push(fornecedoresSub, ordensCompraSub, produtosSub);
  }

  public aplicarFiltro(): void {
    const filtroNormalizado = normalizarTexto(this.filtro);

    this.fornecedoresFiltrados = this.fornecedores.filter(fornecedor => {
      let matches = true;

      if (filtroNormalizado) {
        matches = normalizarTexto(fornecedor.nome).includes(filtroNormalizado);
      }

      if (this.filtroStatus) {
        matches = matches && fornecedor.status === this.filtroStatus;
      }

      return matches;
    });
    this.page = 1; // Resetar para a primeira página ao aplicar filtro
  }

  public abrirModal(): void {
    this.fornecedorEditando = null;
    this.fornecedorForm.reset({ status: EStatusFornecedor.ATIVO });
    this.resetarFiltroOrdens();
    this.filtrarOrdensDoFornecedor();
  }

  public editarFornecedor(fornecedor: IFornecedor): void {
    this.fornecedorEditando = fornecedor;
    this.resetarFiltroOrdens();
    this.filtrarOrdensDoFornecedor();
    this.fornecedorForm.patchValue({
      nome: fornecedor.nome,
      cpfCnpj: fornecedor.cpfCnpj,
      status: fornecedor.status,
      telefone: fornecedor.telefone,
      email: fornecedor.email,
      rua: fornecedor.rua,
      bairro: fornecedor.bairro,
      numero: fornecedor.numero,
      cep: fornecedor.cep,
      cidade: fornecedor.cidade,
      estado: fornecedor.estado,
      categoria: fornecedor.categoria,
      observacao: fornecedor.observacao,
    });

    if (this.featureToggleService.isUsuarioVisualizador) {
      this.fornecedorForm.disable();
    } else {
      this.fornecedorForm.enable();
    }
  }

  public async salvarFornecedor(): Promise<void> {
    if (!this.fornecedorForm.valid) {
      // Marcar todos os campos como touched para mostrar erros
      return Object.keys(this.fornecedorForm.controls).forEach(key => {
        this.fornecedorForm.get(key)?.markAsTouched();
      });
    }

    this.salvando = true;

    const fornecedorData = this.fornecedorForm.value as Omit<IFornecedor, 'id'>;

    // Verificar se já existe um fornecedor com o mesmo nome
    const nomeExistente = this.fornecedores.find(
      f =>
        f.nome.toLowerCase() === fornecedorData.nome.toLowerCase() &&
        (!this.fornecedorEditando || f.id !== this.fornecedorEditando.id)
    );

    if (nomeExistente) {
      this.alertService.warning(
        'Já existe um fornecedor com este nome! Por favor, escolha outro nome.',
        'Aviso'
      );
      this.salvando = false;
      return;
    }

    try {
      if (this.fornecedorEditando) {
        await this.dataService.updateFornecedor(
          this.fornecedorEditando.id!,
          fornecedorData
        );
      } else {
        await this.dataService.addFornecedor(fornecedorData);
      }

      this.fecharModal();

      this.fornecedorForm.reset();
      this.fornecedorEditando = null;
    } catch (error: FirebaseError | any) {
      this.alertService.error(
        'Ocorreu um erro ao salvar fornecedor. Por Favor, tente novamente.',
        'Aviso',
        {
          autoClose: false,
        }
      );
      console.error('Erro ao salvar fornecedor:', error);
    } finally {
      this.salvando = false;
    }
  }

  public confirmarExclusao(fornecedor: IFornecedor): void {
    this.fornecedorParaExcluir = fornecedor;
    this.deleteModalInstance = new bootstrap.Modal(
      document.getElementById('confirmDeleteModal')
    );
    this.deleteModalInstance.show();
  }

  public get qtdOrdensVinculadasFornecedor(): number {
    if (!this.fornecedorParaExcluir) return 0;
    return this.getOrdensVinculadasFornecedor(this.fornecedorParaExcluir.id!);
  }

  private getOrdensVinculadasFornecedor(fornecedorId: string): number {
    return this.ordensCompra.filter(ordem =>
      ordem.itens.some(item => item.fornecedorId === fornecedorId)
    ).length;
  }

  public async excluirFornecedor(): Promise<void> {
    if (this.fornecedorParaExcluir) {
      const qtdOrdens = this.getOrdensVinculadasFornecedor(
        this.fornecedorParaExcluir.id!
      );

      if (qtdOrdens > 0) {
        this.alertService.warning(
          `Não é possível excluir este fornecedor pois há ${qtdOrdens} ordem(ns) de compra vinculada(s).`,
          'Aviso'
        );
        return;
      }

      this.excluindo = true;

      try {
        await this.dataService.deleteFornecedor(this.fornecedorParaExcluir.id!);
        this.fecharModalExclusao();
        this.fornecedorParaExcluir = null;
      } catch (error: FirebaseError | any) {
        this.alertService.error(
          'Erro ao excluir fornecedor. Por Favor, tente novamente.',
          'Aviso',
          {
            autoClose: false,
          }
        );
        console.error('Erro ao excluir fornecedor:', error);
      } finally {
        this.excluindo = false;
      }
    }
  }

  private fecharModal(): void {
    const modalElement = document.getElementById('fornecedorModal');
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

  // Getters para validação do formulário
  get nome() {
    return this.fornecedorForm.get('nome');
  }

  get cpfCnpj() {
    return this.fornecedorForm.get('cpfCnpj');
  }

  get status() {
    return this.fornecedorForm.get('status');
  }

  get categoria() {
    return this.fornecedorForm.get('categoria');
  }

  get email() {
    return this.fornecedorForm.get('email');
  }

  public getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      [EStatusFornecedor.ATIVO]: 'badge-success',
      [EStatusFornecedor.INATIVO]: 'badge-warning',
      [EStatusFornecedor.EXCLUIDO]: 'badge-danger',
    };
    return `badge ${map[status] ?? 'badge-secondary'}`;
  }

  public getInitials(name: string): string {
    return getTwoLetterAcronym(name);
  }

  // --- Aba de Ordens de Compra ---

  private resetarFiltroOrdens(): void {
    this.filtroOrdem = '';
    this.filtroOrdemStatus = '';
    this.filtroOrdemDataInicio = '';
    this.filtroOrdemDataFim = '';
    this.pageOrdens = 1;
  }

  public limparFiltroOrdens(): void {
    this.resetarFiltroOrdens();
    this.aplicarFiltroOrdens();
  }

  private filtrarOrdensDoFornecedor(): void {
    const fornecedorId = this.fornecedorEditando?.id;
    this.ordensCompraDoFornecedor = fornecedorId
      ? this.ordensCompra.filter(ordem =>
          ordem.itens.some(item => item.fornecedorId === fornecedorId)
        )
      : [];
    this.aplicarFiltroOrdens();
  }

  public aplicarFiltroOrdens(): void {
    const filtroNormalizado = normalizarTexto(this.filtroOrdem);
    const dataInicio = this.filtroOrdemDataInicio
      ? new Date(`${this.filtroOrdemDataInicio}T00:00:00`)
      : null;
    const dataFim = this.filtroOrdemDataFim
      ? new Date(`${this.filtroOrdemDataFim}T23:59:59.999`)
      : null;

    this.ordensCompraFiltradas = this.ordensCompraDoFornecedor.filter(ordem => {
      let matches = true;

      if (filtroNormalizado) {
        matches = normalizarTexto(ordem.descricao).includes(filtroNormalizado);
      }

      if (dataInicio && ordem.createdAt) {
        matches = matches && new Date(ordem.createdAt) >= dataInicio;
      }

      if (dataFim && ordem.createdAt) {
        matches = matches && new Date(ordem.createdAt) <= dataFim;
      }

      if (this.filtroOrdemStatus) {
        matches = matches && ordem.status === this.filtroOrdemStatus;
      }

      return matches;
    });
    this.pageOrdens = 1;
  }

  private getValorProduto(produtoId: string): number {
    return this.produtos.find(p => p.id === produtoId)?.valor ?? 0;
  }

  public getValorTotalOrdem(ordem: IOrdemCompra): number {
    return ordem.itens.reduce(
      (total, item) =>
        total + this.getValorProduto(item.produtoId) * item.quantidade,
      0
    );
  }

  public get valorTotalOrdensFiltradas(): number {
    return this.ordensCompraFiltradas.reduce(
      (total, ordem) => total + this.getValorTotalOrdem(ordem),
      0
    );
  }

  public formatarMoeda(valor: number): string {
    return convertSalaryToPtBrCurrency(valor);
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
}
