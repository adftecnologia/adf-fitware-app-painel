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
import { Observable, Subscription, firstValueFrom } from 'rxjs';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import {
  ROLE_COLORS,
  STATUS_COLORS,
} from '../../shared/constants/helper.const';
import {
  EListaComTodos,
  EUsuarioKeyPermission,
  EUsuarioPerfil,
  EUsuarioStatus,
} from '../../shared/enums/sistema.enum';
import {
  getTwoLetterAcronym,
  normalizarTexto,
} from '../../shared/functions/sistema.function';
import {
  IFornecedor,
  ISecretaria,
  IUsuario,
  IUsuarioPermission,
} from '../../shared/models/sistema.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { ApiVercelService } from '../../shared/services/api-vercel-service/api-vercel.service';
import { DataService } from '../../shared/services/data-service/data.service';
import { LoadingService } from '../../shared/services/loading-service/loading.service';
import { ConditionalPasswordValidators } from '../../shared/validators/conditional-password/conditional-password.validators';

declare var bootstrap: any;

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxPaginationModule,
    NgSelectModule,
    SkeletonComponent,
  ],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit, OnDestroy {
  public readonly itensPorPagina: number = 10;
  public readonly ePerfilUsuario = EUsuarioPerfil;
  public readonly eStatusUsuario = EUsuarioStatus;

  public apiLoadingListaUsuarios$!: Observable<boolean>;

  public usuarios: IUsuario[] = [];
  public usuariosFiltrados: IUsuario[] = [];
  public usuarioEditando: IUsuario | null = null;
  public usuarioParaExcluir: IUsuario | null = null;

  public usuarioForm!: FormGroup;

  public indicantesInit: IFornecedor[] = [];
  public indicantes: IFornecedor[] = [];
  public selectIndicante: IFornecedor | null = null;
  public indicantesSelecionados: IFornecedor[] = [];
  private qtdTotalIndicantes: number = 0;

  public secretariasInit: ISecretaria[] = [];
  public secretarias: ISecretaria[] = [];
  public selectSecretaria: ISecretaria | null = null;
  public secretariasSelecionadas: ISecretaria[] = [];
  private qtdTotalSecretarias: number = 0;

  public filtro = '';
  public salvando = false;
  public excluindo = false;
  public totalUsuarios: number = 0;
  public page: number = 1;
  public mostrarPassword: boolean = false;
  public mostrarConfirmacaoPassword: boolean = false;

  private subscriptions: Subscription[] = [];
  private deleteModalInstance: any;
  private userModalInstance: any;

  constructor(
    private readonly dataService: DataService,
    private readonly fb: FormBuilder,
    private readonly alertService: AlertService,
    private readonly apiVercelService: ApiVercelService,
    public readonly loadingService: LoadingService
  ) {}

  public ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Getter para validação do formulário
  get name() {
    return this.usuarioForm.get('name');
  }

  get email() {
    return this.usuarioForm.get('email');
  }

  get role() {
    return this.usuarioForm.get('role');
  }

  get status() {
    return this.usuarioForm.get('status');
  }

  get password() {
    return this.usuarioForm.get('password');
  }

  get confirmPassword() {
    return this.usuarioForm.get('confirmPassword');
  }

  get isVisualizadorSelecionado(): boolean {
    return this.usuarioForm.get('role')?.value === EUsuarioPerfil.VISUALIZADOR;
  }

  get isCadastradorSelecionado(): boolean {
    return this.usuarioForm.get('role')?.value === EUsuarioPerfil.CADASTRADOR;
  }

  get passwordErrors(): string[] {
    const errors: string[] = [];
    const formErrors = this.usuarioForm.errors;

    // Só mostrar erros se o campo password foi tocado ou se algum campo de senha foi tocado
    const anyPasswordFieldTouched =
      this.password?.touched || this.confirmPassword?.touched;

    if (!anyPasswordFieldTouched) {
      return errors;
    }

    if (formErrors?.['passwordRequired']) {
      errors.push(formErrors['passwordRequired'].message);
    }

    if (formErrors?.['passwordRequiredWhenEditing']) {
      errors.push(formErrors['passwordRequiredWhenEditing'].message);
    }

    if (formErrors?.['passwordMinLength']) {
      errors.push(formErrors['passwordMinLength'].message);
    }

    return errors;
  }

  get confirmPasswordErrors(): string[] {
    const errors: string[] = [];
    const formErrors = this.usuarioForm.errors;

    // Só mostrar erros se algum campo de senha foi tocado
    const anyPasswordFieldTouched =
      this.password?.touched || this.confirmPassword?.touched;

    if (!anyPasswordFieldTouched) {
      return errors;
    }

    if (formErrors?.['confirmPasswordRequired']) {
      errors.push(formErrors['confirmPasswordRequired'].message);
    }

    if (formErrors?.['confirmPasswordRequiredWhenEditing']) {
      errors.push(formErrors['confirmPasswordRequiredWhenEditing'].message);
    }

    if (formErrors?.['passwordsMismatch']) {
      errors.push(formErrors['passwordsMismatch'].message);
    }

    return errors;
  }

  get isPasswordRequired(): boolean {
    return (
      !this.usuarioEditando ||
      !!(this.password?.value?.trim() || this.confirmPassword?.value?.trim())
    );
  }

  get disableButtonSalvar(): boolean {
    if (this.salvando || this.usuarioForm.invalid) {
      return true;
    }

    if (
      this.isVisualizadorSelecionado &&
      (this.indicantesSelecionados.length === 0 ||
        this.secretariasSelecionadas.length === 0)
    ) {
      return true;
    }

    return false;
  }

  private initForm(): void {
    this.usuarioForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      status: [EUsuarioStatus.ATIVO, [Validators.required]],
      role: ['', [Validators.required]],
      password: [''],
      confirmPassword: [''],
    });

    // Aplicar validators dinâmicos
    this.updatePasswordValidators();

    // Escutar mudanças nos campos de senha para re-validar
    this.usuarioForm.get('password')?.valueChanges.subscribe(() => {
      setTimeout(() => this.updatePasswordValidators(), 0);
    });

    this.usuarioForm.get('confirmPassword')?.valueChanges.subscribe(() => {
      setTimeout(() => this.updatePasswordValidators(), 0);
    });
  }

  private updatePasswordValidators(): void {
    const isEditing = !!this.usuarioEditando;

    // Remove validators existentes
    this.usuarioForm.clearValidators();

    // Aplica validators condicionais
    this.usuarioForm.setValidators([
      ConditionalPasswordValidators.conditionalPasswordRequired(isEditing),
      ConditionalPasswordValidators.passwordsMatch(),
      ConditionalPasswordValidators.passwordMinLength(6),
    ]);

    // Atualiza validação sem resetar o estado touched
    this.usuarioForm.updateValueAndValidity({ emitEvent: false });
  }

  private resetFormState(): void {
    // Resetar estado de todos os campos para pristine e untouched
    Object.keys(this.usuarioForm.controls).forEach(key => {
      const control = this.usuarioForm.get(key);
      control?.markAsUntouched();
      control?.markAsPristine();
    });
  }

  public getUsuarios(): void {
    const usuariosSub = this.apiVercelService
      .getUsuarios()
      .subscribe(({ data }) => {
        this.usuarios = data.users.map(usuario => ({
          ...usuario,
          id: (usuario as any).uid,
        }));
        this.totalUsuarios = data.total;
        this.aplicarFiltro();
      });
    this.subscriptions.push(usuariosSub);
  }

  private loadData(): void {
    this.getUsuarios();

    this.apiLoadingListaUsuarios$ =
      this.loadingService.getListaUsuariosLoading() as Observable<boolean>;

    // const indicantesSub = this.dataService.getIndicantes.subscribe(
    //   indicantes => {
    //     this.qtdTotalIndicantes = indicantes.length;
    //     this.indicantes = [
    //       {
    //         id: EListaComTodos.TODOS,
    //         nome: 'Todos os Indicantes',
    //         categoria: '',
    //       } as any,
    //       ...indicantes,
    //     ];
    //     this.indicantesInit = [...this.indicantes];
    //   }
    // );

    const secretariasSub = this.dataService.getSecretarias.subscribe(
      secretarias => {
        this.qtdTotalSecretarias = secretarias.length;
        this.secretarias = [
          {
            id: EListaComTodos.TODOS,
            nome: 'Todas as Secretarias',
            lotacoes: [],
          },
          ...secretarias,
        ];
        this.secretariasInit = [...this.secretarias];
      }
    );

    // this.subscriptions.push(indicantesSub, secretariasSub);
    this.subscriptions.push(secretariasSub);
  }

  public aplicarFiltro(): void {
    if (!this.filtro.trim()) {
      this.usuariosFiltrados = [...this.usuarios];
    } else {
      const filtroNormalizado = normalizarTexto(this.filtro);

      this.usuariosFiltrados = this.usuarios.filter(
        ({ name, email }) =>
          normalizarTexto(name).includes(filtroNormalizado) ||
          normalizarTexto(email).includes(filtroNormalizado)
      );
    }
    this.page = 1;
  }

  public abrirModal(): void {
    this.indicantes = [...this.indicantesInit];
    this.secretarias = [...this.secretariasInit];
    this.secretariasSelecionadas = [];
    this.indicantesSelecionados = [];
    this.usuarioEditando = null;
    this.usuarioForm.reset();
    this.updatePasswordValidators();
    this.resetFormState();

    this.mostrarModalUsuario();
  }

  public editarUsuario(usuario: IUsuario): void {
    this.indicantes = [...this.indicantesInit];
    this.secretarias = [...this.secretariasInit];

    this.usuarioEditando = usuario;
    this.usuarioForm.patchValue({
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
      status: usuario.status,
      password: '', // Limpa a senha para edição
      confirmPassword: '', // Limpa a confirmação de senha
    });

    // Atualiza validators para modo de edição
    this.updatePasswordValidators();
    this.resetFormState();

    // const indicantesPermission = usuario.permissions?.find(
    //   p => p.key === EUsuarioKeyPermission.INDICANTES
    // ) as IUsuarioPermission;

    const secretariasPermission = usuario.permissions?.find(
      p => p.key === EUsuarioKeyPermission.SECRETARIAS
    ) as IUsuarioPermission;

    this.indicantesSelecionados = []; /*indicantesPermission
      ? this.indicantes.filter(indicante =>
          indicantesPermission?.resources.some(ind => ind === indicante.id)
        )
      : [];*/

    this.secretariasSelecionadas = secretariasPermission
      ? this.secretarias.filter(secretaria =>
          secretariasPermission?.resources.some(sec => sec === secretaria.id)
        )
      : [];

    this.indicantes = this.indicantes.filter(
      indicante => !this.indicantesSelecionados.find(i => i.id === indicante.id)
    );

    this.secretarias = this.secretarias.filter(
      secretaria =>
        !this.secretariasSelecionadas.find(s => s.id === secretaria.id)
    );

    this.mostrarModalUsuario();
  }

  public async salvarUsuario(): Promise<void> {
    if (!this.usuarioForm.valid) {
      return Object.keys(this.usuarioForm.controls).forEach(key => {
        this.usuarioForm.get(key)?.markAsTouched();
      });
    }
    this.salvando = true;
    this.usuarioForm.disable();

    this.configModalCadastroAtualizacao();

    const { confirmPassword, ...data } = this.usuarioForm.value;

    // Se for edição e a senha estiver vazia, não incluir no payload
    const usuarioData: IUsuario = {
      ...data,
      uid: this.usuarioEditando ? this.usuarioEditando.id : undefined,
      permissions: this.generatePermissions(),
    };

    // Remove password se estiver vazia durante edição
    if (this.usuarioEditando && !data.password?.trim()) {
      delete usuarioData.password;
    }

    try {
      if (this.usuarioEditando) {
        const { data } = await firstValueFrom(
          this.apiVercelService.updateUsuario({ usuario: usuarioData })
        );

        const updatedUser = data.user;

        this.usuarios = this.usuarios.map(usuario =>
          usuario.id === (updatedUser as any).uid
            ? { ...updatedUser, id: (updatedUser as any).uid }
            : usuario
        );
      } else {
        const { data } = await firstValueFrom(
          this.apiVercelService.createUsuario({ usuario: usuarioData })
        );
        const novoUsuario = { ...data.user, id: (data.user as any).uid };
        this.usuarios.push(novoUsuario);
      }

      this.alertService.success(
        `Usuário ${this.usuarioEditando ? 'atualizado' : 'criado'} com sucesso`,
        'Sucesso',
        {
          autoClose: true,
        }
      );

      this.fecharModal();

      this.usuarioForm.reset();
      this.usuarioEditando = null;
      this.aplicarFiltro();
    } catch (error: FirebaseError | any) {
      this.alertService.error(
        error.message || 'Aviso',
        `Ocorreu um erro ao ${this.usuarioEditando ? 'atualizar' : 'criar'} usuário.`,
        {
          autoClose: false,
        }
      );
      console.error('Erro ao salvar usuário:', error);
    } finally {
      this.salvando = false;
      this.usuarioForm.enable();

      this.configModalCadastroAtualizacao(true);
    }
  }

  public confirmarExclusao(usuario: IUsuario): void {
    this.usuarioParaExcluir = usuario;

    this.deleteModalInstance = new bootstrap.Modal(
      document.getElementById('confirmDeleteModal'),
      {
        backdrop: 'static', // Desabilita fechar clicando fora
        keyboard: false, // Desabilita fechar com ESC
      }
    );
    this.deleteModalInstance.show();
  }

  private mostrarModalUsuario(): void {
    // Configurar modal com proteções
    this.userModalInstance = new bootstrap.Modal(
      document.getElementById('usuarioModal'),
      {
        backdrop: 'static', // Desabilita fechar clicando fora
        keyboard: false, // Desabilita fechar com ESC
      }
    );
    this.userModalInstance.show();
  }

  public async excluirUsuario(): Promise<void> {
    if (!this.usuarioParaExcluir) {
      this.alertService.warning(
        'Nenhum usuário selecionado para exclusão.',
        'Aviso'
      );
      return;
    }

    this.excluindo = true;

    this.configModalExclusao();

    try {
      await firstValueFrom(
        this.apiVercelService.deleteUsuario({
          uid: this.usuarioParaExcluir.id!,
        })
      );

      this.usuarios = this.usuarios.map(usuario => ({
        ...usuario,
        ...(usuario.id === this.usuarioParaExcluir?.id
          ? { status: EUsuarioStatus.EXCLUIDO }
          : {}),
      }));

      this.fecharModalExclusao();
      this.usuarioParaExcluir = null;
      this.aplicarFiltro();

      this.alertService.success(
        'Usuário excluído com sucesso. Ele aparecerá na lista, porém com o status "Excluído"',
        'Sucesso',
        {
          autoCloseTime: 5000,
          autoClose: true,
        }
      );
    } catch (error: FirebaseError | any) {
      this.alertService.error(
        error.message || 'Aviso',
        'Erro ao excluir usuário. Por Favor, tente novamente.',
        {
          autoClose: false,
        }
      );
      console.error('Erro ao excluir usuário:', error);
    } finally {
      this.excluindo = false;
      this.configModalExclusao(true);
    }
  }

  private fecharModal(): void {
    if (this.userModalInstance) {
      this.userModalInstance.hide();
    } else {
      // Fallback para caso a instância não exista
      const modalElement = document.getElementById('usuarioModal');
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    }
  }

  private configModalCadastroAtualizacao(restore?: boolean): void {
    if (this.userModalInstance) {
      const modalElement = document.getElementById('usuarioModal');

      if (modalElement) {
        if (restore) {
          modalElement.removeAttribute('data-bs-backdrop');
          modalElement.removeAttribute('data-bs-keyboard');
          return;
        }
        modalElement.setAttribute('data-bs-backdrop', 'static');
        modalElement.setAttribute('data-bs-keyboard', 'false');
      }
    }
  }

  private configModalExclusao(restore?: boolean): void {
    // Torna o modal mais restritivo durante a exclusão
    if (this.deleteModalInstance) {
      const modalElement = document.getElementById('confirmDeleteModal');

      if (modalElement) {
        if (restore) {
          modalElement.removeAttribute('data-bs-backdrop');
          modalElement.removeAttribute('data-bs-keyboard');
          return;
        }
        modalElement.setAttribute('data-bs-backdrop', 'static');
        modalElement.setAttribute('data-bs-keyboard', 'false');
      }
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

  public hasTodosIndicantesSelecionados(): boolean {
    const itemTodosSelecionados = this.indicantesSelecionados.some(
      indicante => indicante.id === EListaComTodos.TODOS
    );

    if (itemTodosSelecionados) {
      return true;
    }

    return this.indicantesSelecionados.length === this.qtdTotalIndicantes;
  }

  public hasTodosSecretariasSelecionadas(): boolean {
    const itemTodosSelecionados = this.secretariasSelecionadas.some(
      secretaria => secretaria.id === EListaComTodos.TODOS
    );

    if (itemTodosSelecionados) {
      return true;
    }

    return this.secretariasSelecionadas.length === this.qtdTotalSecretarias;
  }

  public adicionarIndicantes(): void {
    const indicante = this.selectIndicante as IFornecedor;
    const indicantesFilter = this.indicantes.filter(i => i.id !== indicante.id);

    if (indicante.id === EListaComTodos.TODOS) {
      this.indicantes = [...indicantesFilter, ...this.indicantesSelecionados];
      this.indicantesSelecionados = [indicante];
    } else {
      this.indicantesSelecionados.push(indicante);
      this.indicantes = indicantesFilter;
    }

    this.selectIndicante = null;
  }

  public adicionarSecretarias(): void {
    const secretaria = this.selectSecretaria as ISecretaria;
    const secretariasFilter = this.secretarias.filter(
      s => s.id !== secretaria.id
    );

    if (secretaria.id === EListaComTodos.TODOS) {
      this.secretarias = [
        ...secretariasFilter,
        ...this.secretariasSelecionadas,
      ];
      this.secretariasSelecionadas = [secretaria];
    } else {
      this.secretariasSelecionadas.push(secretaria);
      this.secretarias = secretariasFilter;
    }

    this.selectSecretaria = null;
  }

  public removerIndicante(indicante: IFornecedor): void {
    this.indicantesSelecionados = this.indicantesSelecionados.filter(
      i => i.id !== indicante.id
    );

    this.indicantes =
      indicante.id === EListaComTodos.TODOS
        ? [indicante, ...this.indicantes]
        : [...this.indicantes, indicante];
  }

  public removerSecretaria(secretaria: ISecretaria): void {
    this.secretariasSelecionadas = this.secretariasSelecionadas.filter(
      s => s.id !== secretaria.id
    );
    this.secretarias =
      secretaria.id === EListaComTodos.TODOS
        ? [secretaria, ...this.secretarias]
        : [...this.secretarias, secretaria];
  }

  public limparArrayPermissoes(): void {
    if (this.role?.value !== EUsuarioPerfil.VISUALIZADOR) {
      this.indicantesSelecionados = [];
      this.secretariasSelecionadas = [];
      this.indicantes = [...this.indicantesInit];
      this.secretarias = [...this.secretariasInit];
    }
  }

  private generatePermissions(): IUsuarioPermission[] {
    if (this.role?.value === EUsuarioPerfil.VISUALIZADOR) {
      const indicantesPermissions = this.indicantesSelecionados.map(
        item => item.id
      );
      const secretariasPermissions = this.secretariasSelecionadas.map(
        item => item.id
      );

      return [
        // {
        //   key: EUsuarioKeyPermission.INDICANTES,
        //   resources: indicantesPermissions,
        // },
        {
          key: EUsuarioKeyPermission.SECRETARIAS,
          resources: secretariasPermissions,
        },
      ] as IUsuarioPermission[];
    }
    return [];
  }

  public getBadgeClassForRole(role: EUsuarioPerfil): string {
    return ROLE_COLORS[role] || 'badge bg-secondary text-white';
  }

  public getBadgeClassForStatus(status: EUsuarioStatus): string {
    return STATUS_COLORS[status] || 'badge bg-secondary text-white';
  }
}
