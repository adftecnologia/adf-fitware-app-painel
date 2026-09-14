import {
  ECategoriaProduto,
  EColaboradorStatus,
  EDistrito,
  EStatusFornecedor,
  EStatusOrdemCompra,
  ETipoContrato,
  ETipoPagamentoFuncionario,
  EUnidadeProduto,
  EUsuarioKeyPermission,
  EUsuarioPerfil,
  EUsuarioStatus,
} from '../enums/sistema.enum';
import { IDefaultDate } from './date.model';

export interface IPessoa extends IDefaultDate {
  id?: string;
  nome: string;
  telefone: string;
  dataInicio: string;
  indicante: string;
  secretaria: string;
  tipoContrato: ETipoContrato;
  salario: number;
  endereco: string;
  observacao: string;
  funcao: string;
  distrito: EDistrito;
  cargaHoraria: string;
  lotacao: string;
  usuario?: string;
}

export interface IFornecedor extends IDefaultDate {
  id?: string;
  nome: string;
  cpfCnpj: string;
  status: EStatusFornecedor;
  telefone?: string;
  email?: string;
  rua?: string;
  bairro?: string;
  numero?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  categoria: string;
  observacao?: string;
}

export interface IEscola extends IDefaultDate {
  id?: string;
  nome: string;
  status: string;
  contato: string;
  email: string;
  rua: string;
  bairro: string;
  numero: string;
  cep: string;
  cidade: string;
  estado: string;
  qtdAlunos: number;
  dataInicioContrato: string;
  dataFimContrato: string;
  valorCafeManha?: number;
  valorAlmoco?: number;
  valorCafeTarde?: number;
  estoque?: IEstoqueItem[];
  lancamentosEstoque?: IEstoqueLancamento[];
  refeicoes?: IRefeicao[];
}

export interface ISecretaria extends IDefaultDate {
  id?: string;
  nome: string;
  lotacoes: string[];
}

export interface IPessoaPor {
  [key: string]: number;
}

export interface IDashboardCount {
  totalPessoas: number;
  // totalIndicantes: number;
  totalSecretarias: number;
  mediaSalarial: number;
}

export interface IDashboardStats extends IDashboardCount {
  // pessoasPorIndicante: IPessoaPor;
  pessoasPorSecretaria: IPessoaPor;
  pessoasPorTipoContrato: IPessoaPor;
  ultimasPessoas: IPessoa[];
}

export interface IFilterOptions {
  indicante?: string | null;
  secretaria?: string | null;
  tipoContrato?: string | null;
  busca?: string;
}

export interface IFiltroRelatorio {
  indicante?: string | null;
  secretaria?: string | null;
  lotacao?: string | null;
  tipoContrato?: string | null;
  distrito?: string | null;
  tipoFiltro?: string | null;
}

export interface IUsuarioPermission {
  key: EUsuarioKeyPermission;
  resources: string[];
}

export interface IUsuario extends IDefaultDate {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: EUsuarioPerfil;
  status: EUsuarioStatus;
  permissions: IUsuarioPermission[];
  qtdPessoasCadastradas?: number;
}

export interface IRoutesSistema {
  path: string;
  title: string;
  icon: string;
}

export interface IProduto extends IDefaultDate {
  id?: string;
  descricao: string;
  valor?: number;
  gtin?: string;
  marca?: string;
  categoria: ECategoriaProduto;
  unidade?: EUnidadeProduto;
  observacao?: string;
}

export interface IEstoqueItem {
  produtoId: string;
  descricao: string;
  quantidade: number;
  quantidadeMinima: number;
  unidade?: EUnidadeProduto;
}

export interface IEstoqueLancamento extends IDefaultDate {
  id?: string;
  produtoId: string;
  descricao: string;
  quantidade: number;
  unidade?: EUnidadeProduto;
  tipo: 'Entrada' | 'Saída';
  observacao?: string;
  usuarioId?: string;
  usuarioNome?: string;
  dataHoraLancamento: string;
}

export type TPeriodoRefeicao = 'Café da manhã' | 'Almoço' | 'Café da tarde';

export interface IRefeicaoItem {
  produtoId: string;
  descricao: string;
  quantidade: number;
  unidade?: EUnidadeProduto;
}

export interface IRefeicao extends IDefaultDate {
  id: string;
  periodo: TPeriodoRefeicao;
  dataServida: string;
  quantidadePorcoes: number;
  itens: IRefeicaoItem[];
}

export interface IOrdemCompraItem {
  fornecedorId: string;
  produtoId: string;
  categoriaId: ECategoriaProduto;
  quantidade: number;
  unidade?: EUnidadeProduto;
  observacao?: string;
}

export interface IOrdemCompra extends IDefaultDate {
  id?: string;
  numero: number;
  descricao: string;
  observacao?: string;
  status: EStatusOrdemCompra;
  itens: IOrdemCompraItem[];
}

export interface INotaFiscal extends IDefaultDate {
  id?: string;
  numero: string;
  serie: string;
  chaveAcesso: string;
  descricao?: string;
  tipo: string;
  dataEmissao: string;
  dataVencimento: string;
  fornecedor: string;
  valor: number;
  status: string;
  observacao: string;
  anexoPdfBase64?: string;
  anexoPdfUrl?: string;
  nomeArquivo?: string;
}

export interface IEscolaComEstoque extends IEscola {
  estoque?: IEstoqueItem[];
}

export interface IColaborador extends IDefaultDate {
  id?: string;
  nome: string;
  cpf?: string;
  email?: string;
  telefone: string;
  funcao: string;
  dataInicioContrato: string;
  dataFimContrato?: string;
  tipoContrato?: ETipoContrato;
  statusColaborador: EColaboradorStatus;
  alocacao: string;
  cargaHoraria: string;
  rua?: string;
  bairro?: string;
  numero?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  observacao?: string;
  salario: number;
  diaPagamento: string;
  dadosBancarios?: IDadosBancariosColaborador;
}

export interface IDadosBancariosColaborador {
  tipoPagamento: ETipoPagamentoFuncionario;
  banco: string;
  agencia?: string;
  conta?: string;
  pix?: string;
}
