import { Injectable, OnDestroy } from '@angular/core';
import { FirebaseError } from '@angular/fire/app';
import { Unsubscribe } from 'firebase/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { ECollectionFirebase } from '../../enums/firebase.enum';
import { ELocalStorage } from '../../enums/localstorage.enum';
import { ICurrentUserFirebase } from '../../models/firebase.model';
import { IUsuario } from '../../models/sistema.model';
import { FirebaseService } from '../firebase-service/firebase.service';
import { LoadingService } from '../loading-service/loading.service';
import { LocalstorageService } from '../localstorage-service/localstorage.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private currentUserSubject = new BehaviorSubject<ICurrentUserFirebase>(
    undefined
  );
  private currentUserProfile: IUsuario | null = null;
  private onAuthStateChangedUnsubscribe: Unsubscribe;

  constructor(
    private readonly localStorageService: LocalstorageService,
    private readonly loadingService: LoadingService,
    private readonly firebaseService: FirebaseService
  ) {
    this.onAuthStateChangedUnsubscribe =
      this.firebaseService.onAuthStateChanged(this.currentUserSubject);
  }

  public ngOnDestroy(): void {
    this.onAuthStateChangedUnsubscribe();
  }

  get getCurrentUserObservable(): Observable<ICurrentUserFirebase> {
    return this.currentUserSubject.asObservable();
  }

  public async getCurrentUserProfile(
    userId: string
    // showAlertErro?: boolean TODO - Aplicar alert se precisar
  ): Promise<IUsuario | null> {
    try {
      const userProfile =
        await this.firebaseService.getDataByIdFromFirestore<IUsuario>(
          ECollectionFirebase.USUARIOS,
          userId
        );

      if (userProfile) {
        userProfile.permissions = [];
      }

      this.currentUserProfile = userProfile;
      return userProfile;
    } catch (error) {
      console.error('Ocorreu um erro ao chamar usuário');
      return null;
    }
  }

  get getCurrentUser(): ICurrentUserFirebase {
    return this.currentUserSubject.value;
  }

  get getUserProfile(): IUsuario | null {
    return this.currentUserProfile;
  }

  public async login(
    email: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<void> {
    return this.firebaseService
      .signInWithEmailAndPassword(email, password)
      .then(userCredential => {
        this.localStorageService.setItem(
          ELocalStorage.USUARIO,
          userCredential.user.email || email
        );
        this.loadingService.show();
      })
      .catch((error: FirebaseError) => {
        const errors = {
          'auth/invalid-credential': 'E-mail ou Senha inválidos',
          'auth/wrong-password': 'E-mail ou Senha incorreta',
          'auth/too-many-requests':
            'Muitas tentativas. Tente novamente mais tarde',
          'auth/user-disabled':
            'Usuário desabilitado ou excluído. Por favor, contate o administrador.',
        };
        throw new Error(
          errors[error.code as keyof typeof errors] ??
            'Erro ao fazer login. Verifique suas credenciais'
        );
      });
  }

  public async checkPasswordUserLoggedIn(password: string): Promise<boolean> {
    return this.firebaseService
      .reauthenticateWithCredential(password)
      .then(() => true)
      .catch(() => false);
  }

  public async logout(): Promise<void> {
    this.loadingService.show('Deslogando...');

    return this.firebaseService
      .signOut()
      .then(() => this.localStorageService.clear())
      .catch(() => {
        throw new Error('Erro ao fazer logout');
      });
  }

  public isAuthenticated(): Observable<ICurrentUserFirebase> {
    return this.getCurrentUserObservable;
  }
}
