import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../shared/services/auth-service/auth.service';
import { AlertService } from './../../shared/services/alert-service/alert.service';
import { FirebaseService } from './../../shared/services/firebase-service/firebase.service';

@Component({
  selector: 'app-perfil-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil-usuario.component.html',
  styleUrls: ['./perfil-usuario.component.css'],
})
export class PerfilUsuarioComponent implements OnInit {
  @ViewChild('senhaForm') senhaForm!: NgForm;

  public nome: string = '';
  public email: string = '';
  public status: string = '';
  public perfil: string = '';
  public isLoading: boolean = false;

  // Propriedades para alteração de senha
  public senhaAtual: string = '';
  public novaSenha: string = '';
  public confirmarSenha: string = '';
  public mostrarSenhaAtual: boolean = false;
  public mostrarNovaSenha: boolean = false;
  public mostrarConfirmarSenha: boolean = false;
  public alterandoSenha: boolean = false;

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly authService: AuthService,
    private readonly alertService: AlertService
  ) {}

  public ngOnInit(): void {
    this.carregarUsuario();
  }

  private carregarUsuario(): void {
    const { email, displayName } = this.firebaseService.getCurrentUser() || {};
    const { status, role } = this.authService.getUserProfile || {};

    this.nome = displayName || '';
    this.email = email ?? 'Usuário não logado';
    this.status = status ?? 'N/A';
    this.perfil = role ?? 'Inválido';
  }

  public async salvarPerfil(): Promise<void> {
    this.isLoading = true;
    this.firebaseService
      .updateUserProfile({ nome: this.nome })
      .then(() => {
        this.alertService.success('Perfil atualizado com sucesso!', 'Sucesso', {
          autoClose: true,
        });
        this.carregarUsuario();
      })
      .catch(() => {
        this.alertService.error(
          'Erro ao atualizar perfil. Tente novamente.',
          'Erro'
        );
      })
      .finally(() => (this.isLoading = false));
  }

  public async alterarSenha(): Promise<void> {
    if (this.novaSenha !== this.confirmarSenha) {
      this.alertService.error('As senhas não coincidem', 'Erro');
      return;
    }

    this.alterandoSenha = true;

    try {
      // TODO: Implementar lógica do Firebase para alterar senha
      // await this.firebaseService.changePassword(this.senhaAtual, this.novaSenha);

      const isPasswordValid = await this.authService.checkPasswordUserLoggedIn(
        this.senhaAtual
      );

      if (!isPasswordValid) {
        this.alertService.error('Senha atual inválida', 'Erro');
        this.alterandoSenha = false;
        return;
      }

      await this.firebaseService.updatePassword(this.novaSenha);

      this.alertService.success('Senha alterada com sucesso!', 'Sucesso', {
        autoClose: true,
      });

      // Limpar campos
      this.limparCamposSenha();

      // Fechar modal
      const modal = document.getElementById('alterarSenhaModal');

      if (modal) {
        const bootstrapModal = (window as any).bootstrap.Modal.getInstance(
          modal
        );
        if (bootstrapModal) {
          bootstrapModal.hide();
        }
      }
    } catch (error) {
      this.alertService.error(
        'Erro ao alterar senha. Por favor, tente novamente.',
        'Erro'
      );
      console.error('Erro ao alterar senha:', error);
    } finally {
      this.alterandoSenha = false;
    }
  }

  private limparCamposSenha(): void {
    this.senhaAtual = '';
    this.novaSenha = '';
    this.confirmarSenha = '';
    this.mostrarSenhaAtual = false;
    this.mostrarNovaSenha = false;
    this.mostrarConfirmarSenha = false;
  }

  public resetarFormularioSenha(): void {
    this.limparCamposSenha();

    if (this.senhaForm) {
      this.senhaForm.resetForm();

      Object.keys(this.senhaForm.controls).forEach(key => {
        this.senhaForm.controls[key].markAsUntouched();
        this.senhaForm.controls[key].markAsPristine();
      });
    }
  }
  /*
  public limparFormulario(): void {
    this.nome = '';
    // this.previewUrl = null;

    const fileInput = document.getElementById('fileInput') as HTMLInputElement;

    if (fileInput) {
      fileInput.value = '';
    }
  }
  
  public removerFoto(): void {
    this.previewUrl = null;
    // Limpar o input file
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
  
  public onFileSelected(event: any): void {
    const file = event.target.files[0];
    console.log(file)
    if (file) {
      // Verificar se é uma imagem
      if (file.type.startsWith('image/')) {
        // Verificar tamanho do arquivo (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
          alert('O arquivo deve ter no máximo 5MB.');
          event.target.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.previewUrl = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        alert('Por favor, selecione apenas arquivos de imagem.');
        event.target.value = '';
      }
    }
  }*/
}
