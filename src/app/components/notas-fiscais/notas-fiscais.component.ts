import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { firstValueFrom, Subscription } from 'rxjs';
import { IFornecedor, INotaFiscal } from '../../shared/models/sistema.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { DataService } from '../../shared/services/data-service/data.service';
import { FeatureToggleService } from '../../shared/services/featuretoggle-service/featuretoggle.service';
import { FileUploadService } from '../../shared/services/file-upload-service/file-upload.service';

declare var bootstrap: any;

@Component({
  selector: 'app-notas-fiscais',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxPaginationModule,
    NgSelectModule,
    NgxMaskDirective,
  ],
  templateUrl: './notas-fiscais.component.html',
  styleUrl: './notas-fiscais.component.css',
})
export class NotasFiscaisComponent implements OnInit, OnDestroy {
  public readonly itensPorPagina = 10;
  public notasFiscais: INotaFiscal[] = [];
  public notasFiscaisFiltradas: INotaFiscal[] = [];
  public fornecedores: IFornecedor[] = [];
  public notaFiscalForm!: FormGroup;
  public notaFiscalEditando: INotaFiscal | null = null;
  public notaFiscalParaExcluir: INotaFiscal | null = null;
  public filtro = '';
  public filtroStatus = '';
  public filtroTipo = '';
  public statusOptions = ['Pendente', 'Pago', 'Cancelado'];
  public tipoOptions = ['Entrada', 'Saída'];
  public salvando = false;
  public excluindo = false;
  public totalNotas = 0;
  public page = 1;
  public arquivoSelecionadoName = '';
  public arquivoSelecionadoBase64 = '';
  public activeTab = 'dados';
  public anexoPdfUrlAtual = '';

  private subscriptions: Subscription[] = [];
  private arquivoSelecionadoFile: File | null = null;
  private deleteModalInstance: any;

  constructor(
    private readonly dataService: DataService,
    private readonly fb: FormBuilder,
    private readonly alertService: AlertService,
    public readonly featureToggleService: FeatureToggleService,
    private readonly fileUploadService: FileUploadService
  ) {}

  public ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initForm(): void {
    this.notaFiscalForm = this.fb.group({
      numero: ['', [Validators.required]],
      serie: ['', [Validators.required]],
      chaveAcesso: ['', [Validators.required]],
      descricao: [''],
      tipo: ['Entrada', Validators.required],
      dataEmissao: ['', Validators.required],
      dataVencimento: [''],
      fornecedor: [null, [Validators.required]],
      valor: [0, [Validators.required, Validators.min(0)]],
      status: ['Pendente', Validators.required],
      observacao: [''],
    });
  }

  private loadData(): void {
    const notasSub = this.dataService.getNotasFiscais.subscribe(notas => {
      this.notasFiscais = notas;
      this.totalNotas = notas.length;
      this.aplicarFiltro();
    });

    const fornecedoresSub = this.dataService.getFornecedores.subscribe(
      fornecedores => {
        this.fornecedores = fornecedores;
      }
    );

    this.subscriptions.push(notasSub);
    this.subscriptions.push(fornecedoresSub);
  }

  public aplicarFiltro(): void {
    const filtroLower = this.filtro.trim().toLowerCase();
    const status = this.filtroStatus.trim();
    const tipo = this.filtroTipo.trim();

    this.notasFiscaisFiltradas = this.notasFiscais.filter(nota => {
      let matches = true;

      if (filtroLower) {
        const fornecedorNome = this.getFornecedorNome(
          nota.fornecedor
        ).toLowerCase();
        matches =
          nota.numero.toLowerCase().includes(filtroLower) ||
          fornecedorNome.includes(filtroLower) ||
          nota.chaveAcesso.toLowerCase().includes(filtroLower) ||
          (nota.descricao ?? '').toLowerCase().includes(filtroLower);
      }

      if (status) {
        matches = matches && nota.status === status;
      }

      if (tipo) {
        matches = matches && nota.tipo === tipo;
      }

      return matches;
    });
    this.page = 1; // Resetar para a primeira página ao aplicar filtro
  }

  public abrirModal(): void {
    this.notaFiscalEditando = null;
    this.notaFiscalParaExcluir = null;
    this.arquivoSelecionadoName = '';
    this.arquivoSelecionadoBase64 = '';
    this.arquivoSelecionadoFile = null;
    this.anexoPdfUrlAtual = '';
    this.activeTab = 'dados';
    this.notaFiscalForm.reset({
      numero: '',
      serie: '',
      chaveAcesso: '',
      descricao: '',
      tipo: 'Entrada',
      dataEmissao: '',
      dataVencimento: '',
      fornecedor: null,
      valor: 0,
      status: 'Pendente',
      observacao: '',
    });
  }

  public editarNotaFiscal(nota: INotaFiscal): void {
    this.notaFiscalEditando = nota;
    this.arquivoSelecionadoName = nota.nomeArquivo ?? '';
    this.arquivoSelecionadoBase64 = '';
    this.arquivoSelecionadoFile = null;
    this.anexoPdfUrlAtual = nota.anexoPdfUrl ?? '';
    this.activeTab = 'dados';
    this.notaFiscalForm.patchValue({
      numero: nota.numero,
      serie: nota.serie,
      chaveAcesso: nota.chaveAcesso,
      descricao: nota.descricao ?? '',
      tipo: nota.tipo,
      dataEmissao: nota.dataEmissao,
      dataVencimento: nota.dataVencimento,
      fornecedor: nota.fornecedor,
      valor: nota.valor,
      status: nota.status,
      observacao: nota.observacao,
    });
  }

  public async salvarNotaFiscal(): Promise<void> {
    if (!this.notaFiscalForm.valid) {
      Object.keys(this.notaFiscalForm.controls).forEach(key => {
        this.notaFiscalForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.salvando = true;

    const notaData = {
      ...this.notaFiscalForm.value,
      nomeArquivo: this.arquivoSelecionadoName || undefined,
      anexoPdfUrl: this.anexoPdfUrlAtual || undefined,
    } as Omit<INotaFiscal, 'id'>;

    try {
      if (this.arquivoSelecionadoFile) {
        const base64DoArquivo = this.arquivoSelecionadoBase64 || (await this.converterArquivoParaBase64(this.arquivoSelecionadoFile));
        const base64SemPrefixo = this.fileUploadService.cleanBase64(base64DoArquivo);
        const extension = this.fileUploadService.extractExtensionFromBase64(base64DoArquivo);

        const uploadResponse = await firstValueFrom(
          this.fileUploadService.uploadNotaFiscal(
            this.arquivoSelecionadoName || 'nota-fiscal',
            base64SemPrefixo,
            extension
          )
        );

        const uploadedUrl = uploadResponse?.url || uploadResponse?.['data']?.url || uploadResponse?.['data']?.['data']?.url;

        if (uploadedUrl) {
          this.anexoPdfUrlAtual = uploadedUrl;
          notaData.anexoPdfUrl = uploadedUrl;
        }
      }

      if (this.notaFiscalEditando) {
        await this.dataService.updateNotaFiscal(
          this.notaFiscalEditando.id!,
          notaData
        );
      } else {
        await this.dataService.addNotaFiscal(notaData);
      }

      this.alertService.success('Nota fiscal salva com sucesso', 'Sucesso');
      this.fecharModal();
    } catch (err) {
      console.error(err);
      this.alertService.error('Erro ao salvar nota fiscal');
    } finally {
      this.salvando = false;
    }
  }

  public confirmarExclusao(nota: INotaFiscal): void {
    this.notaFiscalParaExcluir = nota;
    this.deleteModalInstance = new bootstrap.Modal(
      document.getElementById('deleteNotaFiscalModal')
    );
    this.deleteModalInstance.show();
  }

  public async excluirNotaFiscal(): Promise<void> {
    if (!this.notaFiscalParaExcluir?.id) {
      return;
    }

    this.excluindo = true;

    try {
      if (this.notaFiscalParaExcluir.anexoPdfUrl) {
        await this.excluirAnexoNoServidor(this.notaFiscalParaExcluir.anexoPdfUrl);
      }

      await this.dataService.deleteNotaFiscal(this.notaFiscalParaExcluir.id);
      this.deleteModalInstance?.hide();
      this.alertService.success('Nota fiscal excluída com sucesso', 'Sucesso');
    } catch (err) {
      console.error(err);
      this.alertService.error('Erro ao excluir nota fiscal');
    } finally {
      this.excluindo = false;
      this.notaFiscalParaExcluir = null;
    }
  }

  public async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.arquivoSelecionadoFile = null;
      this.arquivoSelecionadoName = '';
      this.arquivoSelecionadoBase64 = '';
      return;
    }

    this.arquivoSelecionadoFile = file;
    this.arquivoSelecionadoName = file.name;
    this.anexoPdfUrlAtual = '';

    try {
      this.arquivoSelecionadoBase64 = await this.converterArquivoParaBase64(file);
      this.alertService.info('Arquivo preparado para envio ao salvar a nota.', 'Informação');
    } catch (err) {
      console.error(err);
      this.alertService.error('Não foi possível ler o arquivo selecionado');
    }
  }

  public baixarAnexo(): void {
    if (!this.anexoPdfUrlAtual) {
      return;
    }

    window.open(this.anexoPdfUrlAtual, '_blank', 'noopener,noreferrer');
  }

  public async removerAnexo(): Promise<void> {
    const urlParaExcluir = this.anexoPdfUrlAtual;

    if (urlParaExcluir) {
      try {
        await this.excluirAnexoNoServidor(urlParaExcluir);
      } catch (err) {
        console.error(err);
        this.alertService.error('Não foi possível remover o anexo do servidor');
        return;
      }
    }

    this.anexoPdfUrlAtual = '';
    this.arquivoSelecionadoName = '';
    this.arquivoSelecionadoBase64 = '';
    this.arquivoSelecionadoFile = null;
    this.alertService.success('Anexo removido com sucesso', 'Sucesso');
  }

  private async excluirAnexoNoServidor(url: string): Promise<void> {
    if (!url) {
      return;
    }

    await firstValueFrom(this.fileUploadService.deleteFileService(url));
  }

  private converterArquivoParaBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  public fecharModal(): void {
    const modalEl = document.getElementById('notaFiscalModal');
    if (modalEl) {
      const modal =
        bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.hide();
    }
  }

  get valor() {
    return this.notaFiscalForm.get('valor');
  }

  public getFornecedorNome(fornecedorId: string): string {
    return (
      this.fornecedores.find(fornecedor => fornecedor.id === fornecedorId)
        ?.nome ?? fornecedorId
    );
  }

  public getInitials(value: string): string {
    return value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
