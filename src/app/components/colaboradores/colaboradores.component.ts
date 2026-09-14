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
import {
  EColaboradorStatus,
  EEscolaAdmin,
  ETipoContrato,
  ETipoPagamentoFuncionario,
} from '../../shared/enums/sistema.enum';
import {
  getTwoLetterAcronym,
  normalizarTexto,
} from '../../shared/functions/sistema.function';
import { IColaborador, IEscola } from '../../shared/models/sistema.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { DataService } from '../../shared/services/data-service/data.service';
import { FeatureToggleService } from '../../shared/services/featuretoggle-service/featuretoggle.service';
import { CpfCnpjValidators } from '../../shared/validators/cpf-cnpj/cpf-cnpj.validators';
import { DataValidators } from '../../shared/validators/data/data.validators';
import { EmailValidators } from '../../shared/validators/email/email.validators';

declare var bootstrap: any;

@Component({
  selector: 'app-colaboradores',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxPaginationModule,
    NgSelectModule,
    NgxMaskDirective,
  ],
  templateUrl: './colaboradores.component.html',
  styleUrl: './colaboradores.component.css',
})
export class ColaboradoresComponent implements OnInit, OnDestroy {
  public readonly itensPorPagina: number = 10;

  public colaboradores: IColaborador[] = [];
  public colaboradoresFiltrados: IColaborador[] = [];

  public colaboradorForm!: FormGroup;
  public colaboradorEditando: IColaborador | null = null;
  public colaboradorParaExcluir: IColaborador | null = null;

  public escolas: IEscola[] = [];

  public filtro = '';
  public filtroStatus = '';
  public filtroAlocacao: string | null = null;
  public readonly statusOptions = Object.values(EColaboradorStatus);
  public readonly tipoContratoOptions = Object.values(ETipoContrato);
  public readonly tipoPagamentoOptions = Object.values(
    ETipoPagamentoFuncionario
  );
  public readonly diaPagamentoOptions = Array.from({ length: 31 }, (_, i) =>
    String(i + 1).padStart(2, '0')
  );

  public salvando = false;
  public excluindo = false;
  public totalColaboradores = 0;
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
    this.colaboradorForm = this.fb.group(
      {
        nome: ['', [Validators.required, Validators.minLength(2)]],
        cpf: ['', [CpfCnpjValidators.cpfValidator()]],
        email: ['', [EmailValidators.emailValido()]],
        telefone: ['', [Validators.required]],
        funcao: ['', [Validators.required]],
        dataInicioContrato: ['', [Validators.required]],
        dataFimContrato: [''],
        tipoContrato: [null],
        statusColaborador: [EColaboradorStatus.ATIVO, [Validators.required]],
        alocacao: ['', [Validators.required]],
        cargaHoraria: ['', [Validators.required]],
        salario: [null, [Validators.required, Validators.min(0)]],
        diaPagamento: [null, [Validators.required]],
        rua: [''],
        bairro: [''],
        numero: [''],
        cep: [''],
        cidade: [''],
        estado: [''],
        observacao: [''],
        dadosBancarios: this.fb.group({
          tipoPagamento: [null, [Validators.required]],
          banco: ['', [Validators.required]],
          agencia: [''],
          conta: [''],
          pix: [''],
        }),
      },
      {
        validators: DataValidators.intervaloContratoValido(),
      }
    );
  }

  private loadData(): void {
    const colaboradoresSub = this.dataService.getColaboradores.subscribe(
      colaboradores => {
        this.colaboradores = colaboradores;
        this.totalColaboradores = colaboradores.length;
        this.aplicarFiltro();
      }
    );

    const escolasSub = this.dataService.getEscolas.subscribe(escolas => {
      this.escolas = [
        {
          id: EEscolaAdmin.ADMINISTRATIVO,
          nome: 'Administrativo',
        } as any,
        ...escolas,
      ];
    });

    this.subscriptions.push(colaboradoresSub, escolasSub);
  }

  public aplicarFiltro(): void {
    const filtroNormalizado = normalizarTexto(this.filtro);

    this.colaboradoresFiltrados = this.colaboradores.filter(colaborador => {
      let matches = true;

      if (filtroNormalizado) {
        matches =
          normalizarTexto(colaborador.nome).includes(filtroNormalizado) ||
          normalizarTexto(colaborador.funcao).includes(filtroNormalizado);
      }

      if (this.filtroStatus) {
        matches =
          matches && colaborador.statusColaborador === this.filtroStatus;
      }

      if (this.filtroAlocacao) {
        matches = matches && colaborador.alocacao === this.filtroAlocacao;
      }

      return matches;
    });
    this.page = 1;
  }

  public limparFiltro(): void {
    this.filtro = '';
    this.filtroStatus = '';
    this.filtroAlocacao = null;
    this.aplicarFiltro();
  }

  public abrirModal(): void {
    this.colaboradorEditando = null;
    this.colaboradorForm.reset({
      statusColaborador: EColaboradorStatus.ATIVO,
      salario: null,
      diaPagamento: null,
    });

    if (this.featureToggleService.isUsuarioVisualizador) {
      this.colaboradorForm.disable();
    } else {
      this.colaboradorForm.enable();
    }
  }

  public editarColaborador(colaborador: IColaborador): void {
    this.colaboradorEditando = colaborador;
    this.colaboradorForm.patchValue({
      nome: colaborador.nome,
      cpf: colaborador.cpf ?? '',
      email: colaborador.email ?? '',
      telefone: colaborador.telefone,
      funcao: colaborador.funcao,
      dataInicioContrato: colaborador.dataInicioContrato,
      dataFimContrato: colaborador.dataFimContrato ?? '',
      tipoContrato: colaborador.tipoContrato ?? null,
      statusColaborador: colaborador.statusColaborador,
      alocacao: colaborador.alocacao,
      cargaHoraria: colaborador.cargaHoraria,
      salario: colaborador.salario ?? null,
      diaPagamento: colaborador.diaPagamento ?? null,
      rua: colaborador.rua ?? '',
      bairro: colaborador.bairro ?? '',
      numero: colaborador.numero ?? '',
      cep: colaborador.cep ?? '',
      cidade: colaborador.cidade ?? '',
      estado: colaborador.estado ?? '',
      observacao: colaborador.observacao ?? '',
      dadosBancarios: {
        tipoPagamento: colaborador.dadosBancarios?.tipoPagamento ?? null,
        banco: colaborador.dadosBancarios?.banco ?? '',
        agencia: colaborador.dadosBancarios?.agencia ?? '',
        conta: colaborador.dadosBancarios?.conta ?? '',
        pix: colaborador.dadosBancarios?.pix ?? '',
      },
    });

    if (this.featureToggleService.isUsuarioVisualizador) {
      this.colaboradorForm.disable();
    } else {
      this.colaboradorForm.enable();
    }
  }

  public async salvarColaborador(): Promise<void> {
    if (!this.colaboradorForm.valid) {
      Object.keys(this.colaboradorForm.controls).forEach(key => {
        this.colaboradorForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.salvando = true;

    const colaboradorData = this.colaboradorForm.value as Omit<
      IColaborador,
      'id'
    >;

    const nomeExistente = this.colaboradores.find(
      c =>
        c.cpf === colaboradorData.cpf &&
        (!this.colaboradorEditando || c.id !== this.colaboradorEditando.id)
    );

    if (nomeExistente) {
      this.alertService.warning(
        'Já existe um colaborador com este CPF!',
        'Aviso'
      );
      this.salvando = false;
      return;
    }

    try {
      if (this.colaboradorEditando) {
        await this.dataService.updateColaborador(
          this.colaboradorEditando.id!,
          colaboradorData
        );
      } else {
        await this.dataService.addColaborador(colaboradorData);
      }

      this.fecharModal();
      this.colaboradorForm.reset();
      this.colaboradorEditando = null;
    } catch (error: FirebaseError | any) {
      this.alertService.error(
        'Ocorreu um erro ao salvar colaborador. Por Favor, tente novamente.',
        'Aviso',
        { autoClose: false }
      );
      console.error('Erro ao salvar colaborador:', error);
    } finally {
      this.salvando = false;
    }
  }

  public confirmarExclusao(colaborador: IColaborador): void {
    this.colaboradorParaExcluir = colaborador;
    this.deleteModalInstance = new bootstrap.Modal(
      document.getElementById('confirmDeleteModalColaborador')
    );
    this.deleteModalInstance.show();
  }

  public async excluirColaborador(): Promise<void> {
    if (this.colaboradorParaExcluir) {
      this.excluindo = true;
      try {
        await this.dataService.deleteColaborador(
          this.colaboradorParaExcluir.id!
        );
        this.fecharModalExclusao();
        this.colaboradorParaExcluir = null;
      } catch (error: FirebaseError | any) {
        this.alertService.error(
          'Erro ao excluir colaborador. Por Favor, tente novamente.',
          'Aviso',
          { autoClose: false }
        );
        console.error('Erro ao excluir colaborador:', error);
      } finally {
        this.excluindo = false;
      }
    }
  }

  private fecharModal(): void {
    const modalElement = document.getElementById('colaboradorModal');
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

  public getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      [EColaboradorStatus.ATIVO]: 'badge-success',
      [EColaboradorStatus.AFASTADO]: 'badge-warning',
      [EColaboradorStatus.DEMITIDO]: 'badge-danger',
      [EColaboradorStatus.EXCLUIDO]: 'badge-danger',
    };
    return `badge ${map[status] ?? 'badge-primary'}`;
  }

  // Getters para validação do formulário
  get nome() {
    return this.colaboradorForm.get('nome');
  }

  get cpf() {
    return this.colaboradorForm.get('cpf');
  }

  get email() {
    return this.colaboradorForm.get('email');
  }

  get telefone() {
    return this.colaboradorForm.get('telefone');
  }

  get funcao() {
    return this.colaboradorForm.get('funcao');
  }

  get dataInicioContrato() {
    return this.colaboradorForm.get('dataInicioContrato');
  }

  get statusColaborador() {
    return this.colaboradorForm.get('statusColaborador');
  }

  get alocacao() {
    return this.colaboradorForm.get('alocacao');
  }

  get cargaHoraria() {
    return this.colaboradorForm.get('cargaHoraria');
  }

  get salario() {
    return this.colaboradorForm.get('salario');
  }

  get diaPagamento() {
    return this.colaboradorForm.get('diaPagamento');
  }

  get tipoPagamento() {
    return this.colaboradorForm.get('dadosBancarios.tipoPagamento');
  }

  get banco() {
    return this.colaboradorForm.get('dadosBancarios.banco');
  }
}
