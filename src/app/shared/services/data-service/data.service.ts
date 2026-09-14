import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, OperatorFunction } from 'rxjs';
import { map } from 'rxjs/operators';
import { ECollectionFirebase } from '../../enums/firebase.enum';
import {
  IColaborador,
  IDashboardStats,
  IEscola,
  IFilterOptions,
  IFornecedor,
  INotaFiscal,
  IOrdemCompra,
  IPessoa,
  IProduto,
  IUsuario,
} from '../../models/sistema.model';
import { AlertService } from '../alert-service/alert.service';
import { FirebaseService } from '../firebase-service/firebase.service';
import { createDateTimeSort } from './../../functions/date.function';
import { ISecretaria } from './../../models/sistema.model';
import { FeatureToggleService } from './../featuretoggle-service/featuretoggle.service';

interface IDataCount {
  [key: string]: number;
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private pessoasSubject$ = new BehaviorSubject<IPessoa[]>([]);
  private escolasSubject$ = new BehaviorSubject<IEscola[]>([]);
  private secretariasSubject$ = new BehaviorSubject<ISecretaria[]>([]);
  private usuariosSubject$ = new BehaviorSubject<IUsuario[]>([]);
  private produtosSubject$ = new BehaviorSubject<IProduto[]>([]);
  private fornecedoresSubject$ = new BehaviorSubject<IFornecedor[]>([]);
  private notasFiscaisSubject$ = new BehaviorSubject<INotaFiscal[]>([]);
  private ordemCompraSubject$ = new BehaviorSubject<IOrdemCompra[]>([]);
  private colaboradoresSubject$ = new BehaviorSubject<IColaborador[]>([]);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly alertService: AlertService,
    private readonly featureToggleService: FeatureToggleService
  ) {
    this.initializeDataListeners();
  }

  private filterPermissionsSecretarias(): OperatorFunction<
    ISecretaria[],
    ISecretaria[]
  > {
    return (source: Observable<ISecretaria[]>): Observable<ISecretaria[]> => {
      if (
        this.featureToggleService.isUsuarioAdmin ||
        this.featureToggleService.isUsuarioCadastrador
      ) {
        return source;
      }

      if (
        this.featureToggleService.isUsuarioVisualizador &&
        this.featureToggleService.isTodasSecretarias
      ) {
        return source;
      }

      return source.pipe(
        map(data => {
          const idsSecretarias =
            this.featureToggleService.idsSecretariasVisualizador;

          return data.filter(item =>
            idsSecretarias.includes(item.id as string)
          );
        })
      );
    };
  }

  private filterPermissionsFornecedores(): OperatorFunction<
    IFornecedor[],
    IFornecedor[]
  > {
    return (source: Observable<IFornecedor[]>): Observable<IFornecedor[]> => {
      if (
        this.featureToggleService.isUsuarioAdmin ||
        this.featureToggleService.isUsuarioCadastrador
      ) {
        return source;
      }

      if (
        this.featureToggleService.isUsuarioVisualizador &&
        this.featureToggleService.isTodosFornecedores
      ) {
        return source;
      }

      return source.pipe(
        map(data => {
          const idsFornecedores =
            this.featureToggleService.idsFornecedoresVisualizador;

          return data.filter(item =>
            idsFornecedores.includes(item.id as string)
          );
        })
      );
    };
  }

  private filterPermissionsPessoas(): OperatorFunction<IPessoa[], IPessoa[]> {
    return (source: Observable<IPessoa[]>): Observable<IPessoa[]> => {
      if (
        this.featureToggleService.isUsuarioAdmin ||
        this.featureToggleService.isUsuarioCadastrador
      ) {
        return source;
      }

      return source.pipe(
        map(data => {
          let resData = data;

          if (this.featureToggleService.isUsuarioVisualizador) {
            if (!this.featureToggleService.isTodasSecretarias) {
              const idsSecretarias =
                this.featureToggleService.idsSecretariasVisualizador;

              resData = resData.filter(item =>
                idsSecretarias.includes(item.secretaria)
              );
            }

            if (!this.featureToggleService.isTodosFornecedores) {
              const idsFornecedores =
                this.featureToggleService.idsFornecedoresVisualizador;

              resData = resData.filter(item =>
                idsFornecedores.includes(item.indicante)
              );
            }
          }
          return resData;
        })
      );
    };
  }

  get getPessoas(): Observable<IPessoa[]> {
    return this.pessoasSubject$
      .asObservable()
      .pipe(this.filterPermissionsPessoas());
  }

  get getEscolas(): Observable<IEscola[]> {
    return this.escolasSubject$.asObservable();
  }

  get getSecretarias(): Observable<ISecretaria[]> {
    return this.secretariasSubject$
      .asObservable()
      .pipe(this.filterPermissionsSecretarias());
  }

  get getUsuarios(): Observable<IUsuario[]> {
    return this.usuariosSubject$.asObservable();
  }

  get getProdutos(): Observable<IProduto[]> {
    return this.produtosSubject$.asObservable();
  }

  get getFornecedores(): Observable<IFornecedor[]> {
    return this.fornecedoresSubject$.asObservable();
  }

  get getNotasFiscais(): Observable<INotaFiscal[]> {
    return this.notasFiscaisSubject$.asObservable();
  }

  get getOrdemCompra(): Observable<IOrdemCompra[]> {
    return this.ordemCompraSubject$.asObservable();
  }

  get getColaboradores(): Observable<IColaborador[]> {
    return this.colaboradoresSubject$.asObservable();
  }

  private initializeDataListeners(): void {
    this.firebaseService.listenToDataChanges<IPessoa>(
      ECollectionFirebase.PESSOAS,
      this.pessoasSubject$
    );

    this.firebaseService.listenToDataChanges<IEscola>(
      ECollectionFirebase.ESCOLAS,
      this.escolasSubject$
    );

    this.firebaseService.listenToDataChanges<ISecretaria>(
      ECollectionFirebase.SECRETARIAS,
      this.secretariasSubject$
    );

    this.firebaseService.listenToDataChanges<IProduto>(
      ECollectionFirebase.PRODUTOS,
      this.produtosSubject$
    );

    this.firebaseService.listenToDataChanges<IFornecedor>(
      ECollectionFirebase.FORNECEDORES,
      this.fornecedoresSubject$
    );

    this.firebaseService.listenToDataChanges<INotaFiscal>(
      ECollectionFirebase.NOTAS_FISCAIS,
      this.notasFiscaisSubject$
    );

    this.firebaseService.listenToDataChanges<IOrdemCompra>(
      ECollectionFirebase.ORDEM_COMPRA,
      this.ordemCompraSubject$
    );

    this.firebaseService.listenToDataChanges<IColaborador>(
      ECollectionFirebase.COLABORADORES,
      this.colaboradoresSubject$
    );
  }

  public getPessoasFiltradas({
    indicante,
    secretaria,
    tipoContrato,
    busca,
  }: IFilterOptions): Observable<IPessoa[]> {
    //TODO - AJUSTAR FILTRO
    return this.getPessoas.pipe(
      map(pessoas => {
        return pessoas.filter(pessoa => {
          let matches = true;

          if (indicante) {
            matches = matches && pessoa.indicante === indicante;
          }

          if (secretaria) {
            matches = matches && pessoa.secretaria === secretaria;
          }

          if (tipoContrato) {
            matches = matches && pessoa.tipoContrato === tipoContrato;
          }

          if (busca) {
            const buscaLower = busca.toLowerCase();
            matches =
              matches &&
              (pessoa.nome.toLowerCase().includes(buscaLower) ||
                pessoa.telefone?.includes(buscaLower) ||
                pessoa.endereco?.toLowerCase().includes(buscaLower));
          }

          return matches;
        });
      })
    );
  }

  public getDashboardStats(
    secretarias: ISecretaria[],
    indicantes: IFornecedor[]
  ): Observable<IDashboardStats> {
    return this.getPessoas.pipe(
      map(pessoas => {
        const totalPessoas = pessoas.length;
        const totalSecretarias = this.secretariasSubject$.value.length;

        // Média salarial
        const mediaSalarial =
          pessoas.length > 0
            ? pessoas.reduce((sum, p) => sum + (p.salario ?? 0), 0) /
              pessoas.length
            : 0;

        const pessoasPorSecretaria: IDataCount = {};
        const pessoasPorTipoContrato: IDataCount = {};

        pessoas.forEach(({ indicante, secretaria, tipoContrato }) => {
          const indicanteAux = indicantes.find(
            (sec: any) => sec.id === indicante
          );
          indicante = indicanteAux ? indicanteAux.nome : 'N/A';

          const secretariaAuxAux = secretarias.find(
            (sec: any) => sec.id === secretaria
          );
          secretaria = secretariaAuxAux ? secretariaAuxAux.nome : 'N/A';

          pessoasPorSecretaria[secretaria] =
            (pessoasPorSecretaria[secretaria] || 0) + 1;

          pessoasPorTipoContrato[tipoContrato] =
            (pessoasPorTipoContrato[tipoContrato] || 0) + 1;
        });

        // Últimas pessoas cadastradas (5 mais recentes)
        const ultimasPessoas = pessoas
          .sort(
            (a, b) =>
              createDateTimeSort(b.createdAt) - createDateTimeSort(a.createdAt)
          )
          .slice(0, 5);

        return {
          totalPessoas,
          totalSecretarias,
          mediaSalarial,
          pessoasPorSecretaria,
          pessoasPorTipoContrato,
          ultimasPessoas,
        };
      })
    );
  }

  public async addPessoa(pessoa: Omit<IPessoa, 'id'>): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<IPessoa, 'id'>>(
      ECollectionFirebase.PESSOAS,
      pessoa
    );
  }

  public async addIndicante(indicante: Omit<IFornecedor, 'id'>): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<IFornecedor, 'id'>>(
      ECollectionFirebase.INDICANTES,
      indicante
    );
  }

  public async addEscola(escola: Omit<IEscola, 'id'>): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<IEscola, 'id'>>(
      ECollectionFirebase.ESCOLAS,
      escola
    );
  }

  public async addUsuario(usuario: Omit<IUsuario, 'id'>): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<IUsuario, 'id'>>(
      ECollectionFirebase.USUARIOS,
      usuario
    );
  }

  public async addSecretaria(
    secretaria: Omit<ISecretaria, 'id'>
  ): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<ISecretaria, 'id'>>(
      ECollectionFirebase.SECRETARIAS,
      secretaria
    );
  }

  public async addNotaFiscal(
    notaFiscal: Omit<INotaFiscal, 'id'>
  ): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<INotaFiscal, 'id'>>(
      ECollectionFirebase.NOTAS_FISCAIS,
      notaFiscal
    );
  }

  public async addProduto(produto: Omit<IProduto, 'id'>): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<IProduto, 'id'>>(
      ECollectionFirebase.PRODUTOS,
      produto,
      'Produto'
    );
  }

  public async addFornecedor(
    fornecedor: Omit<IFornecedor, 'id'>
  ): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<IFornecedor, 'id'>>(
      ECollectionFirebase.FORNECEDORES,
      fornecedor
    );
  }

  public async addOrdemCompra(
    ordemCompra: Omit<IOrdemCompra, 'id'>
  ): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<IOrdemCompra, 'id'>>(
      ECollectionFirebase.ORDEM_COMPRA,
      ordemCompra
    );
  }

  public async addColaborador(
    colaborador: Omit<IColaborador, 'id'>
  ): Promise<void> {
    return this.firebaseService.setDataFromFirestore<Omit<IColaborador, 'id'>>(
      ECollectionFirebase.COLABORADORES,
      colaborador
    );
  }

  public async updateProduto(
    id: string,
    produto: Partial<IProduto>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<IProduto>>(
      ECollectionFirebase.PRODUTOS,
      id,
      produto,
      'Produto'
    );
  }

  public async updatePessoa(
    id: string,
    pessoa: Partial<IPessoa>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<IPessoa>>(
      ECollectionFirebase.PESSOAS,
      id,
      pessoa
    );
  }

  public async updateIndicante(
    id: string,
    indicante: Partial<IFornecedor>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<IFornecedor>>(
      ECollectionFirebase.INDICANTES,
      id,
      indicante
    );
  }

  public async updateEscola(
    id: string,
    escola: Partial<IEscola>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<IEscola>>(
      ECollectionFirebase.ESCOLAS,
      id,
      escola
    );
  }

  public async updateUsuario(
    id: string,
    usuario: Partial<IUsuario>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<IUsuario>>(
      ECollectionFirebase.USUARIOS,
      id,
      usuario
    );
  }

  public async updateSecretaria(
    id: string,
    secretaria: Partial<ISecretaria>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<ISecretaria>>(
      ECollectionFirebase.SECRETARIAS,
      id,
      secretaria
    );
  }

  public async updateNotaFiscal(
    id: string,
    notaFiscal: Partial<INotaFiscal>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<INotaFiscal>>(
      ECollectionFirebase.NOTAS_FISCAIS,
      id,
      notaFiscal
    );
  }

  public async updateFornecedor(
    id: string,
    fornecedor: Partial<IFornecedor>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<IFornecedor>>(
      ECollectionFirebase.FORNECEDORES,
      id,
      fornecedor
    );
  }

  public async updateOrdemCompra(
    id: string,
    ordemCompra: Partial<IOrdemCompra>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<IOrdemCompra>>(
      ECollectionFirebase.ORDEM_COMPRA,
      id,
      ordemCompra
    );
  }

  public async updateColaborador(
    id: string,
    colaborador: Partial<IColaborador>
  ): Promise<void> {
    return this.firebaseService.updateDataFromFirestore<Partial<IColaborador>>(
      ECollectionFirebase.COLABORADORES,
      id,
      colaborador
    );
  }

  public async deletePessoa(id: string): Promise<void> {
    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.PESSOAS,
      id
    );
  }

  public async deleteFornecedor(id: string): Promise<void> {
    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.FORNECEDORES,
      id
    );
  }

  public async deleteEscola(id: string): Promise<void> {
    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.ESCOLAS,
      id
    );
  }

  public async deleteUsuario(id: string): Promise<void> {
    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.USUARIOS,
      id
    );
  }
  public async deleteNotaFiscal(id: string): Promise<void> {
    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.NOTAS_FISCAIS,
      id
    );
  }
  public async deleteSecretaria(id: string): Promise<void> {
    const pessoas = this.pessoasSubject$.value;
    const secretaria = this.secretariasSubject$.value.find(s => s.id === id);

    if (secretaria && pessoas.some(p => p.secretaria === secretaria.nome)) {
      this.alertService.warning(
        'Não é possível excluir esta secretaria pois há pessoas vinculadas a ela.',
        'Alerta'
      );
      return;
    }

    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.SECRETARIAS,
      id
    );
  }

  public async deleteProduto(id: string): Promise<void> {
    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.PRODUTOS,
      id,
      'Produto'
    );
  }

  public async deleteOrdemCompra(id: string): Promise<void> {
    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.ORDEM_COMPRA,
      id,
      'Ordem de Compra'
    );
  }

  public async deleteColaborador(id: string): Promise<void> {
    return this.firebaseService.deleteDataFromFirestore(
      ECollectionFirebase.COLABORADORES,
      id,
      'Colaborador'
    );
  }
}
