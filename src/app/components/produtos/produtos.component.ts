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
import { ECategoriaProduto } from '../../shared/enums/sistema.enum';
import {
  getTwoLetterAcronym,
  normalizarTexto,
} from '../../shared/functions/sistema.function';
import { IEscola, IOrdemCompra, IProduto } from '../../shared/models/sistema.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { DataService } from '../../shared/services/data-service/data.service';
import { FeatureToggleService } from '../../shared/services/featuretoggle-service/featuretoggle.service';

declare var bootstrap: any;

@Component({
  selector: 'app-produtos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxPaginationModule,
    NgSelectModule,
    NgxMaskDirective,
  ],
  templateUrl: './produtos.component.html',
  styleUrls: ['./produtos.component.css'],
})
export class ProdutosComponent implements OnInit, OnDestroy {
  public readonly itensPorPagina: number = 10;

  public produtos: IProduto[] = [];
  public produtosFiltrados: IProduto[] = [];
  public ordensCompra: IOrdemCompra[] = [];
  public escolas: IEscola[] = [];

  public produtoForm!: FormGroup;
  public produtoEditando: IProduto | null = null;
  public produtoParaExcluir: IProduto | null = null;

  public readonly categoriaOptions = Object.values(ECategoriaProduto);

  public filtro = '';
  public filtroCategoria: string | null = null;
  public salvando = false;
  public excluindo = false;
  public totalProdutos = 0;
  public page: number = 1;

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
    this.produtoForm = this.fb.group({
      descricao: ['', [Validators.required, Validators.minLength(2)]],
      categoria: [null, [Validators.required]],
      marca: [''],
      valor: [0, [Validators.min(0)]],
      gtin: [''],
      observacao: [''],
    });
  }

  private loadData(): void {
    const produtosSub = this.dataService.getProdutos.subscribe(produtos => {
      this.produtos = produtos;
      this.totalProdutos = produtos.length;
      this.aplicarFiltro();
    });

    const ordensCompraSub = this.dataService.getOrdemCompra.subscribe(
      ordensCompra => {
        this.ordensCompra = ordensCompra;
      }
    );

    const escolasSub = this.dataService.getEscolas.subscribe(escolas => {
      this.escolas = escolas;
    });

    this.subscriptions.push(produtosSub, ordensCompraSub, escolasSub);
  }

  public aplicarFiltro(): void {
    const filtroNormalizado = normalizarTexto(this.filtro);
    const categoriaFiltro = this.filtroCategoria
      ? normalizarTexto(this.filtroCategoria)
      : null;

    this.produtosFiltrados = this.produtos.filter(produto => {
      const matchDescricao =
        !filtroNormalizado ||
        normalizarTexto(produto.descricao).includes(filtroNormalizado);
      const matchCategoria =
        !categoriaFiltro ||
        normalizarTexto(produto.categoria ?? '').includes(categoriaFiltro);
      return matchDescricao && matchCategoria;
    });
    this.page = 1;
  }

  public abrirModal(): void {
    this.produtoEditando = null;
    this.produtoForm.reset();
  }

  public editarProduto(produto: IProduto): void {
    this.produtoEditando = produto;
    this.produtoForm.patchValue({
      descricao: produto.descricao,
      categoria: produto.categoria ?? null,
      marca: produto.marca ?? '',
      valor: produto.valor ?? 0,
      gtin: produto.gtin ?? '',
      observacao: produto.observacao ?? '',
    });

    if (this.featureToggleService.isUsuarioVisualizador) {
      this.produtoForm.disable();
    } else {
      this.produtoForm.enable();
    }
  }

  public async salvarProduto(): Promise<void> {
    if (!this.produtoForm.valid) {
      return Object.keys(this.produtoForm.controls).forEach(key => {
        this.produtoForm.get(key)?.markAsTouched();
      });
    }

    this.salvando = true;

    const produtoData = this.produtoForm.value as Omit<IProduto, 'id'>;

    const descricaoExistente = this.produtos.find(
      p =>
        p.descricao.toLowerCase() === produtoData.descricao.toLowerCase() &&
        (!this.produtoEditando || p.id !== this.produtoEditando.id)
    );

    if (descricaoExistente) {
      this.alertService.warning(
        'Já existe um produto com esta descrição! Por favor, escolha outra descrição.',
        'Aviso'
      );
      this.salvando = false;
      return;
    }

    try {
      if (this.produtoEditando) {
        await this.dataService.updateProduto(
          this.produtoEditando.id!,
          produtoData
        );
      } else {
        await this.dataService.addProduto(produtoData);
      }

      this.fecharModal();
      this.produtoForm.reset();
      this.produtoEditando = null;
    } catch (error: FirebaseError | any) {
      this.alertService.error(
        'Ocorreu um erro ao salvar produto. Por Favor, tente novamente.',
        'Aviso',
        { autoClose: false }
      );
      console.error('Erro ao salvar produto:', error);
    } finally {
      this.salvando = false;
    }
  }

  public confirmarExclusao(produto: IProduto): void {
    this.produtoParaExcluir = produto;
    this.deleteModalInstance = new bootstrap.Modal(
      document.getElementById('confirmDeleteModalProduto')
    );
    this.deleteModalInstance.show();
  }

  public get qtdOrdensVinculadasProduto(): number {
    if (!this.produtoParaExcluir) return 0;
    return this.getOrdensVinculadasProduto(this.produtoParaExcluir.id!);
  }

  public get qtdEscolasVinculadasProduto(): number {
    if (!this.produtoParaExcluir) return 0;
    return this.getEscolasVinculadasProduto(this.produtoParaExcluir.id!);
  }

  private getOrdensVinculadasProduto(produtoId: string): number {
    return this.ordensCompra.filter(ordem =>
      ordem.itens.some(item => item.produtoId === produtoId)
    ).length;
  }

  private getEscolasVinculadasProduto(produtoId: string): number {
    return this.escolas.filter(escola =>
      (escola.estoque ?? []).some(item => item.produtoId === produtoId)
    ).length;
  }

  public async excluirProduto(): Promise<void> {
    if (this.produtoParaExcluir) {
      const qtdOrdens = this.getOrdensVinculadasProduto(
        this.produtoParaExcluir.id!
      );
      const qtdEscolas = this.getEscolasVinculadasProduto(
        this.produtoParaExcluir.id!
      );

      if (qtdOrdens > 0 || qtdEscolas > 0) {
        const partes: string[] = [];
        if (qtdOrdens > 0) partes.push(`${qtdOrdens} ordem(ns) de compra`);
        if (qtdEscolas > 0)
          partes.push(`${qtdEscolas} escola(s) com estoque deste produto`);

        this.alertService.warning(
          `Não é possível excluir este produto pois está vinculado a ${partes.join(' e ')}.`,
          'Aviso'
        );
        return;
      }

      this.excluindo = true;
      try {
        await this.dataService.deleteProduto(this.produtoParaExcluir.id!);
        this.fecharModalExclusao();
        this.produtoParaExcluir = null;
      } catch (error: FirebaseError | any) {
        this.alertService.error(
          'Erro ao excluir produto. Por Favor, tente novamente.',
          'Aviso',
          { autoClose: false }
        );
        console.error('Erro ao excluir produto:', error);
      } finally {
        this.excluindo = false;
      }
    }
  }

  private fecharModal(): void {
    const modalElement = document.getElementById('produtoModal');
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

  get descricao() {
    return this.produtoForm.get('descricao');
  }

  get categoria() {
    return this.produtoForm.get('categoria');
  }

  get valor() {
    return this.produtoForm.get('valor');
  }

  public getInitials(name: string): string {
    return getTwoLetterAcronym(name);
  }
}
