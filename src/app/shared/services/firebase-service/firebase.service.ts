import { inject, Injectable } from '@angular/core';
import {
  Auth,
  EmailAuthProvider,
  onAuthStateChanged as onAuthStateChangedFirebase,
  reauthenticateWithCredential as reauthenticateWithCredentialFirebase,
  signInWithEmailAndPassword as signInWithEmailAndPasswordFirebase,
  signOut as signOutFirebase,
  updatePassword as updatePasswordFirebase,
  updateProfile as updateProfileFirebase,
  User,
} from '@angular/fire/auth';
import {
  Database,
  DatabaseReference,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from '@angular/fire/database';
import { Unsubscribe, UserCredential } from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';
import { ECollectionFirebase } from '../../enums/firebase.enum';
import {
  createDateTimeFirebase,
  updateDateTimeFirebase,
} from '../../functions/date.function';
import { removeUndefinedProperties } from '../../functions/sistema.function';
import {
  ICurrentUserFirebase,
  IUserProfileUpdate,
} from '../../models/firebase.model';
import { AlertService } from '../alert-service/alert.service';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private readonly auth: Auth = inject(Auth);
  private readonly database: Database = inject(Database);
  private readonly alertService: AlertService = inject(AlertService);

  private getDataRef(
    collection: ECollectionFirebase | string
  ): DatabaseReference {
    return ref(this.database, collection);
  }

  public onAuthStateChanged(
    behaviorSubject: BehaviorSubject<ICurrentUserFirebase>
  ): Unsubscribe {
    return onAuthStateChangedFirebase(this.auth, user =>
      behaviorSubject.next(user)
    );
  }

  public async reauthenticateWithCredential(
    password: string
  ): Promise<UserCredential> {
    const user = this.getCurrentUser() as User;

    const credential = EmailAuthProvider.credential(
      user.email as string,
      password
    );
    return reauthenticateWithCredentialFirebase(user, credential);
  }

  public async signInWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return signInWithEmailAndPasswordFirebase(this.auth, email, password);
  }

  public async signOut(): Promise<void> {
    return signOutFirebase(this.auth);
  }

  public async updatePassword(newPassword: string): Promise<void> {
    const user = this.getCurrentUser() as User;
    return updatePasswordFirebase(user, newPassword);
  }

  public async updateUserProfile({
    nome,
    foto,
  }: IUserProfileUpdate): Promise<void> {
    const user = this.getCurrentUser();

    if (user) {
      // Depois adicionar lógica para atualizar senha.
      return updateProfileFirebase(user, {
        displayName: nome,
        photoURL: foto,
      });
    }
    return Promise.resolve();
  }

  public getCurrentUser(): ICurrentUserFirebase {
    return this.auth.currentUser || null;
  }

  public getDataFromFirestore<T>(
    collection: ECollectionFirebase,
    behaviorSubject: BehaviorSubject<T[]>
  ): Unsubscribe {
    const dataRef = this.getDataRef(collection);

    return onValue(dataRef, snapshot => {
      const data = snapshot.val();
      const result: T[] = data
        ? Object.keys(data).map(key => ({ id: key, ...data[key] }))
        : [];

      // Ver possibilidade de adicionar posteriormente
      // this.alertService.success(
      //   `Lista de ${collection} atualizada`,
      //   'Atualização'
      // );

      behaviorSubject.next(
        result.sort((a, b) => (a as any).nome?.localeCompare((b as any)?.nome))
      );
    });
  }

  /**
   * Escuta mudanças incrementais na coleção (apenas dados novos/modificados/removidos)
   * Mais eficiente que getDataFromFirestore pois não baixa todos os dados a cada mudança
   */
  public listenToDataChanges<T>(
    collection: ECollectionFirebase,
    behaviorSubject: BehaviorSubject<T[]>
  ): () => void {
    const dataRef = this.getDataRef(collection);

    let currentData: T[] = [];
    let isInitialLoad = true;
    let existingKeys = new Set<string>();

    let unsubscribeAdd: () => void;
    let unsubscribeChange: () => void;
    let unsubscribeRemove: () => void;

    const nextBehaviorSubject = (data: T[]) => {
      behaviorSubject.next(
        data.sort((a, b) => (a as any).nome?.localeCompare((b as any)?.nome))
      );
    };

    // Primeiro, carrega dados existentes uma vez
    const initialUnsubscribe = onValue(dataRef, snapshot => {
      const data = snapshot.val();
      currentData = data
        ? Object.keys(data).map(key => ({ id: key, ...data[key] }))
        : [];

      // Armazena as chaves dos itens existentes
      existingKeys = new Set(currentData.map((item: any) => item.id));

      nextBehaviorSubject(currentData);

      // Desinscreve do carregamento inicial
      initialUnsubscribe();

      // Marca que carregamento inicial foi concluído
      isInitialLoad = false;

      // Agora escuta apenas as mudanças incrementais
      setupIncrementalListeners();
    });

    const setupIncrementalListeners = () => {
      // Escutar novos itens adicionados
      unsubscribeAdd = onChildAdded(dataRef, snapshot => {
        // Só processa se não for carregamento inicial E se o item não existia antes
        if (!isInitialLoad && !existingKeys.has(snapshot.key!)) {
          const newItem = { id: snapshot.key, ...snapshot.val() } as T;

          currentData = [...currentData, newItem];
          existingKeys.add(snapshot.key!);

          nextBehaviorSubject(currentData);
        }
      });

      // Escutar itens modificados
      unsubscribeChange = onChildChanged(dataRef, snapshot => {
        const updatedItem = { id: snapshot.key, ...snapshot.val() } as T;

        currentData = currentData.map(item =>
          (item as any).id === snapshot.key ? updatedItem : item
        );

        nextBehaviorSubject(currentData);
      });

      // Escutar itens removidos
      unsubscribeRemove = onChildRemoved(dataRef, snapshot => {
        currentData = currentData.filter(
          item => (item as any).id !== snapshot.key
        );

        existingKeys.delete(snapshot.key!);

        nextBehaviorSubject(currentData);
      });
    };

    // Retorna função para desinscrever todos os listeners
    return () => {
      unsubscribeAdd?.();
      unsubscribeChange?.();
      unsubscribeRemove?.();
    };
  }

  public getDataByIdFromFirestore<T>(
    collection: ECollectionFirebase,
    pathId: string
  ): Promise<T | null> {
    const dataRef = this.getDataRef(`${collection}/${pathId}`);

    return new Promise<T | null>((resolve, reject) => {
      const unsubscribe = onValue(
        dataRef,
        snapshot => {
          try {
            const data = snapshot.val();

            if (data) {
              const result: T = data.uid
                ? data
                : ({ id: snapshot.key, ...data } as T);
              resolve(result);
            } else {
              resolve(null);
            }

            unsubscribe();
          } catch (error) {
            reject(error);
          }
        },
        error => {
          reject(error);
        }
      );
    });
  }

  public async setDataFromFirestore<T>(
    collection: ECollectionFirebase,
    data: T,
    successMessage?: string
  ): Promise<void> {
    const dataRef = this.getDataRef(collection);
    const newDataRef = push(dataRef);

    const newData = createDateTimeFirebase<T>(data);

    const cleanData = removeUndefinedProperties<T>(newData);

    return set(newDataRef, cleanData)
      .then(() => {
        this.alertService.success(
          `${successMessage ?? 'Registro'} salvo com sucesso`,
          'Sucesso'
        );
      })
      .catch(() => {
        this.alertService.error(
          `Ocorreu um erro ao salvar ${successMessage ?? 'o Registro'}`
        );
      });
  }

  public async updateDataFromFirestore<T>(
    collection: ECollectionFirebase,
    id: string,
    data: T,
    successMessage?: string
  ): Promise<void> {
    const dataRef = this.getDataRef(`${collection}/${id}`);

    const updateData = updateDateTimeFirebase<T>(data) as Partial<T>;
    const cleanData = removeUndefinedProperties<Partial<T>>(updateData);

    return update(dataRef, cleanData)
      .then(() => {
        this.alertService.success(
          `${successMessage ?? 'Registro'} atualizado com sucesso`,
          'Sucesso'
        );
      })
      .catch(() => {
        this.alertService.error(
          `Ocorreu um erro ao atualizar ${successMessage ?? 'o Registro'}`
        );
      });
  }

  public async deleteDataFromFirestore(
    collection: ECollectionFirebase,
    id: string,
    successMessage?: string
  ): Promise<void> {
    const dataRef = this.getDataRef(`${collection}/${id}`);

    return remove(dataRef)
      .then(() => {
        this.alertService.success(
          `${successMessage ?? 'Registro'} excluído com sucesso`,
          'Sucesso'
        );
      })
      .catch(() => {
        this.alertService.error(
          `Ocorreu um erro ao excluir ${successMessage ?? 'o Registro'}`
        );
      });
  }
}
