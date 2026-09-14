import { IFornecedor, ISecretaria } from './sistema.model';

export interface IDataReport {
  reportName: string;
  title: string;
}

export interface IIndicanteSecretariaMap {
  secretaria: ISecretaria;
  qtdPessoas: number;
}

export interface IIndicanteMap {
  nomeIndicante: IFornecedor['nome'];
  secretarias: IIndicanteSecretariaMap[];
}
