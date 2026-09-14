export enum ETipoContrato {
  COMISSIONADO = 'Comissionado',
  ESTAGIARIO = 'Estagiário',
  TEMPORARIO = 'Temporário',
  INSTITUTO = 'Instituto',
  EFETIVO = 'Efetivo',
  OUTROS = 'Outros',
}

export enum EDistrito {
  SEDE = 'SEDE',
  BARRA_NOVA = 'Barra Nova',
  CARRAPATERIAS = 'Carrapateiras',
  INHAMUNS = 'Inhamuns',
  MARRECAS = 'Marrecas',
  MARRUAS = 'Marruás',
  SANTA_TEREZA = 'Santa Tereza',
  TRICI = 'Trici',
}

export enum ETipoFiltro {
  // TODOS = 'Todos',
  INDICANTES = 'Indicantes',
  DETALHES_INDICANTE = 'Detalhes por Indicante',
}

export enum EUsuarioPerfil {
  ADMIN = 'Admin',
  CADASTRADOR = 'Cadastrador',
  VISUALIZADOR = 'Visualizador',
}

export enum EUsuarioStatus {
  ATIVO = 'Ativo',
  INATIVO = 'Inativo',
  EXCLUIDO = 'Excluido',
}

export enum EColaboradorStatus {
  ATIVO = 'Ativo',
  AFASTADO = 'Afastado',
  DEMITIDO = 'Demitido',
  EXCLUIDO = 'Excluido',
}

export enum EUsuarioKeyPermission {
  PESSOAS = 'pessoas',
  FORNECEDORES = 'fornecedores',
  SECRETARIAS = 'secretarias',
  // RELATORIOS = 'relatorios',
  // USUARIOS = 'usuarios',
}

export enum EEscolaAdmin {
  ADMINISTRATIVO = 'Administrativo',
}

export enum EListaComTodos {
  TODOS = 'TODOS',
}

export enum EStatusFornecedor {
  ATIVO = 'Ativo',
  INATIVO = 'Inativo',
  EXCLUIDO = 'Excluído',
}

export enum EStatusOrdemCompra {
  EMITIDA = 'Emitida',
  EM_PROCESSO = 'Em Processo',
  RECEBIDA = 'Recebida',
  FINALIZADA = 'Finalizada',
  PAGA = 'Paga',
  CANCELADA = 'Cancelada',
}

export enum ETipoPagamentoFuncionario {
  PIX = 'PIX',
  DINHEIRO = 'Dinheiro',
  CHEQUE = 'Cheque',
  TRANSFERENCIA_BANCARIA = 'Transferência Bancária',
  OUTROS = 'Outros',
}

export enum EUnidadeProduto {
  UNIDADE = 'Unidade',
  LITRO = 'Litro',
  KILOGRAMA = 'Kilograma',
  PACOTE = 'Pacote',
  CAIXA = 'Caixa',
}

export enum ECategoriaProduto {
  GRAOS_CEREAIS = 'Grãos e Cereais',
  PROTEINAS = 'Proteínas (Carnes e Pescados)',
  HORTALICAS_VERDURAS = 'Hortaliças e Verduras',
  FRUTAS = 'Frutas',
  LATICINIOS_OVOS = 'Laticínios e Ovos',
  OLEOS_GORDURAS = 'Óleos e Gorduras',
  TEMPEROS_CONDIMENTOS = 'Temperos e Condimentos',
  FARINACEOS_PANIFICACAO = 'Farináceos e Panificação',
  ACUCARES_DOCES = 'Açúcares e Doces',
  BEBIDAS = 'Bebidas',
  ENLATADOS_CONSERVAS = 'Enlatados e Conservas',
  HIGIENE_LIMPEZA = 'Higiene e Limpeza',
  UTENSILIOS_DESCARTAVEIS = 'Utensílios e Descartáveis',
  OUTROS = 'Outros',
}
