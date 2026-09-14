import { inject, Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import {
  Content,
  Table,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { BehaviorSubject } from 'rxjs';
import { PDFMAKE_TABLE_LAYOUT } from '../../constants/pdfmake.const';
import {
  convertDatetimeToDate,
  createDateTimeNowPtBr,
} from '../../functions/date.function';
import {
  IDataReport,
  IIndicanteMap,
  IIndicanteSecretariaMap,
} from '../../models/pdf-make.model';
import {
  IFornecedor,
  IOrdemCompra,
  IPessoa,
  IProduto,
  ISecretaria,
} from '../../models/sistema.model';
import { AlertService } from '../alert-service/alert.service';
import { PDFMAKE_STYLES } from './../../constants/pdfmake.const';
import {
  convertSalaryToPtBrCurrency,
  formatWorkload,
  getTipoContratoByValue,
} from './../../functions/sistema.function';

(pdfMake as any).vfs = (pdfFonts as any).vfs;

@Injectable({
  providedIn: 'root',
})
export class PdfMakeService {
  // Modal state management
  private isVisibleSubject = new BehaviorSubject<boolean>(false);
  private pdfBlobSubject = new BehaviorSubject<Blob | null>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private dataReport = new BehaviorSubject<IDataReport>({
    reportName: 'relatorio',
    title: 'Relatório',
  });

  // Observables públicos para o modal
  public readonly isVisible$ = this.isVisibleSubject.asObservable();
  public readonly pdfBlob$ = this.pdfBlobSubject.asObservable();
  public readonly isLoading$ = this.isLoadingSubject.asObservable();
  public readonly dataReport$ = this.dataReport.asObservable();

  private readonly alertService: AlertService = inject(AlertService);

  /**
   * Abre o modal com loading enquanto gera o PDF
   * @param pdfPromise - Promise que resolve com o Blob do PDF
   */
  public async openModalWithPromise(
    pdfPromise: Promise<Blob>,
    reportName: IDataReport
  ): Promise<void> {
    try {
      this.isLoadingSubject.next(true);
      this.isVisibleSubject.next(true);
      this.dataReport.next(reportName);

      const pdfBlob = await pdfPromise;
      this.pdfBlobSubject.next(pdfBlob);
    } catch (error) {
      this.alertService.error('Erro ao gerar PDF', 'Aviso', {
        autoClose: false,
      });
      console.error('Erro ao gerar PDF:', error);
      this.closeModal();
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Fecha o modal
   */
  public closeModal(): void {
    this.isVisibleSubject.next(false);
    this.pdfBlobSubject.next(null);
    this.isLoadingSubject.next(false);
  }

  /**
   * Verifica se o modal está visível
   */
  get isModalVisible(): boolean {
    return this.isVisibleSubject.value;
  }

  /**
   * Gera relatório agrupado por indicantes e abre no modal
   * @param indicantes - Array de indicantes
   * @param pessoas - Array de pessoas
   * @param secretarias - Array de secretarias
   */
  public gerarRelatorioIndicantesModal(
    indicantes: IFornecedor[],
    pessoas: IPessoa[],
    secretarias: ISecretaria[]
  ): Promise<void> {
    const pdfPromise = this.gerarRelatorioIndicantes(
      indicantes,
      pessoas,
      secretarias
    );
    return this.openModalWithPromise(pdfPromise, {
      reportName: 'relatorio_indicantes',
      title: 'Relatório de Indicantes',
    });
  }

  /**
   * Gera relatório detalhado por indicante e abre no modal
   * @param indicante - Indicante a ser filtrado
   * @param pessoas - pessoas a serem filtradas
   * @param secretarias - Array de secretarias
   */
  /*
  public gerarRelatorioPorIndicanteModal(
    indicante: IFornecedor,
    pessoas: IPessoa[],
    secretarias: ISecretaria[]
  ): Promise<void> {
    const pdfPromise = this.gerarRelatorioPorIndicante(
      indicante,
      pessoas,
      secretarias
    );
    return this.openModalWithPromise(pdfPromise, {
      reportName: 'relatorio_por_indicante',
      title: `Relatório de Pessoas por Indicante: ${indicante.nome} - ${indicante.tipo}`,
    });
  }*/

  /**
   * Gera relatório detalhado para todos os indicantes em um único PDF
   * @param indicantes - Array de indicantes
   * @param pessoas - Array de pessoas
   * @param secretarias - Array de secretarias
   */
  public gerarRelatorioTodosIndicantesModal(
    indicantes: IFornecedor[],
    pessoas: IPessoa[],
    secretarias: ISecretaria[]
  ): Promise<void> {
    const pdfPromise = this.gerarRelatorioTodosIndicantes(
      indicantes,
      pessoas,
      secretarias
    );
    return this.openModalWithPromise(pdfPromise, {
      reportName: 'relatorio_todos_indicantes',
      title: 'Relatório Detalhado de Todos os Indicantes',
    });
  }
  /**
   * Gera relatório agrupado por indicantes
   * @param indicantes - Array de indicantes
   * @param pessoas - Array de pessoas
   * @param secretarias - Array de secretarias
   */
  public gerarRelatorioIndicantes(
    indicantes: IFornecedor[],
    pessoas: IPessoa[],
    secretarias: ISecretaria[]
  ): Promise<Blob> {
    const headerContent = this.createDefaultHeader('Relatório de Indicantes');
    const data: TableCell[] = this.gerarConteudoTableRelatorioIndicantes(
      indicantes,
      secretarias,
      pessoas
    );

    const tableContent = this.createDefaultTable(
      ['5%', '*', '35%', '8%', '8%'],
      data
    );

    const docDefinition: TDocumentDefinitions = {
      pageOrientation: 'landscape',
      content: [headerContent, tableContent],
      styles: PDFMAKE_STYLES,
    };

    return this.createPdfBlob(docDefinition);
  }

  /**
   * Gera relatório detalhado por indicante
   * @param indicante - Indicante a ser filtrado
   * @param pessoas - pessoas a serem filtradas
   * @param secretarias - Array de secretarias
   */
  /*public gerarRelatorioPorIndicante(
    indicante: IFornecedor,
    pessoas: IPessoa[],
    secretarias: ISecretaria[]
  ): Promise<Blob> {
    const headerContent = this.createDefaultHeader(
      `Relatório de Indicantes\nIndicante: ${indicante.nome} - ${indicante.tipo}`
    );
    const data: TableCell[] = this.gerarConteudoTableRelatorioPorIndicantes(
      indicante,
      secretarias,
      pessoas
    );

    const tableContent = this.createDefaultTable(
      ['5%', '*', '*', '*', '15%', '12%', '12%', '7%'],
      data
    );

    const docDefinition: TDocumentDefinitions = {
      pageOrientation: 'landscape',
      content: [headerContent, tableContent],
      styles: PDFMAKE_STYLES,
    };

    return this.createPdfBlob(docDefinition);
  }*/

  /**
   * Gera relatório detalhado para todos os indicantes em um único PDF com quebra de página
   * @param indicantes - Array de indicantes
   * @param pessoas - Array de pessoas
   * @param secretarias - Array de secretarias
   */

  public gerarRelatorioTodosIndicantes(
    indicantes: IFornecedor[],
    pessoas: IPessoa[],
    secretarias: ISecretaria[]
  ): Promise<Blob> {
    const headerContent = this.createDefaultHeader(
      `Relatório Detalhado de Todos os Indicantes\nTOTAL INDICANTES: ${indicantes.length}`
    );

    // Filtrar indicantes que têm pessoas associadas
    // desabilitado, pois deve mostrar todos.
    // const indicantesComPessoas = indicantes.filter(indicante =>
    //   pessoas.some(pessoa => pessoa.indicante === indicante.id)
    // );

    // Gerar conteúdo para cada indicante
    const indicantesArray: TableCell[] = indicantes
      .map((indicante, idx) => {
        const subHeader: Content = {
          text: `${indicante.nome} - ${indicante.categoria}`,
          style: 'subheader',
          margin: [0, 20, 0, 10],
          bold: true,
        };

        const data: TableCell[] = this.gerarConteudoTableRelatorioPorIndicantes(
          indicante,
          secretarias,
          pessoas
        );

        const tableContent = this.createDefaultTable(
          ['5%', '*', '*', '*', '15%', '12%', '12%', '7%'],
          data
        );

        // Adicionar quebra de página se não for o último indicante
        const pageBreak =
          idx < indicantes.length - 1 ? [{ text: '', pageBreak: 'after' }] : [];

        return [subHeader, tableContent, ...pageBreak];
      })
      .flat();

    indicantesArray.unshift(headerContent);

    const docDefinition: TDocumentDefinitions = {
      pageOrientation: 'landscape',
      content: indicantesArray as Content[],
      styles: PDFMAKE_STYLES,
    };

    return this.createPdfBlob(docDefinition);
  }

  /**
   * Gera relatório de uma ordem de compra e abre no modal
   * @param ordem - Ordem de compra a ser exportada
   * @param fornecedores - Array de fornecedores
   * @param produtos - Array de produtos
   */
  public gerarRelatorioOrdemCompraModal(
    ordem: IOrdemCompra,
    fornecedores: IFornecedor[],
    produtos: IProduto[]
  ): Promise<void> {
    const pdfPromise = this.gerarRelatorioOrdemCompra(
      ordem,
      fornecedores,
      produtos
    );
    return this.openModalWithPromise(pdfPromise, {
      reportName: `relatorio_ordem_compra_${ordem.descricao}`,
      title: `Relatório de Ordem de Compra: ${ordem.descricao}`,
    });
  }

  /**
   * Gera relatório de uma ordem de compra com as informações e itens
   * @param ordem - Ordem de compra a ser exportada
   * @param fornecedores - Array de fornecedores
   * @param produtos - Array de produtos
   */
  public gerarRelatorioOrdemCompra(
    ordem: IOrdemCompra,
    fornecedores: IFornecedor[],
    produtos: IProduto[]
  ): Promise<Blob> {
    const headerContent = this.createDefaultHeader(
      `Relatório de Ordem de Compra\n${ordem.descricao}\n`
    );

    const infoContent = this.gerarInfoOrdemCompra(ordem, fornecedores);

    const data: TableCell[] = this.gerarConteudoTableItensOrdemCompra(
      ordem,
      produtos
    );

    const tableContent = this.createDefaultTable(
      ['5%', '*', '15%', '8%', '10%', '12%', '12%', '18%'],
      data
    );

    const docDefinition: TDocumentDefinitions = {
      pageOrientation: 'landscape',
      content: [...headerContent, infoContent, tableContent],
      styles: PDFMAKE_STYLES,
    };

    return this.createPdfBlob(docDefinition);
  }

  private gerarInfoOrdemCompra(
    ordem: IOrdemCompra,
    fornecedores: IFornecedor[]
  ): Content {
    const fornecedorId = ordem.itens[0]?.fornecedorId;
    const nomeFornecedor =
      fornecedores.find(f => f.id === fornecedorId)?.nome ?? 'Não informado';

    const infoRows: TableCell[][] = [
      [
        { text: 'Número:', bold: true, margin: [0, 1] },
        { text: ordem.numero?.toString() ?? '—', margin: [0, 2] },
        { text: 'Status:', bold: true, margin: [0, 2] },
        { text: ordem.status, margin: [0, 2] },
      ],
      [
        { text: 'Fornecedor:', bold: true, margin: [0, 1] },
        { text: nomeFornecedor, margin: [0, 2] },
        { text: 'Criado em:', bold: true, margin: [0, 2] },
        { text: convertDatetimeToDate(ordem.createdAt), margin: [0, 2] },
      ],
      [
        { text: 'Descrição:', bold: true, margin: [0, 1] },
        { text: ordem.descricao, colSpan: 3, margin: [0, 2] },
        {},
        {},
      ],
      [
        { text: 'Observação:', bold: true, margin: [0, 1] },
        { text: ordem.observacao || '—', colSpan: 3, margin: [0, 2] },
        {},
        {},
      ],
    ];

    return {
      table: {
        widths: ['10%', '*', '10%', '*'],
        body: infoRows,
      },
      layout: 'noBorders',
      margin: [0, 5, 0, 15],
    };
  }

  private gerarConteudoTableItensOrdemCompra(
    ordem: IOrdemCompra,
    produtos: IProduto[]
  ): TableCell[] {
    const produtoMap = new Map<IProduto['id'], IProduto>(
      produtos.map(p => [p.id, p])
    );

    let valorTotalOrdem = 0;

    const itensArray: TableCell[] = ordem.itens.map((item, idx) => {
      // regra para fazer o zebrado de cores na tabela
      const fillColor = idx % 2 !== 0 ? '#f1f1f1' : null;

      const produto = produtoMap.get(item.produtoId);
      const valorUnitario = produto?.valor ?? 0;
      const valorTotalItem = valorUnitario * item.quantidade;
      valorTotalOrdem += valorTotalItem;

      return [
        {
          text: (idx + 1).toString(),
          alignment: 'center',
          margin: [0, 1],
          fillColor,
        },
        {
          text: produto?.descricao ?? 'Não informado',
          alignment: 'left',
          margin: [0, 1],
          fillColor,
        },
        {
          text: item.categoriaId,
          alignment: 'left',
          margin: [0, 1],
          fillColor,
        },
        {
          text: item.quantidade.toString(),
          alignment: 'center',
          margin: [0, 1],
          fillColor,
        },
        {
          text: item.unidade || '—',
          alignment: 'center',
          margin: [0, 1],
          fillColor,
        },
        {
          text: convertSalaryToPtBrCurrency(valorUnitario),
          alignment: 'right',
          margin: [0, 1],
          fillColor,
        },
        {
          text: convertSalaryToPtBrCurrency(valorTotalItem),
          alignment: 'right',
          margin: [0, 1],
          fillColor,
        },
        {
          text: item.observacao || '—',
          alignment: 'left',
          margin: [0, 1],
          fillColor,
        },
      ];
    });

    const tableHeader: TableCell[] = [
      { text: '#', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Produto', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Categoria', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Qtd', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Unidade', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Valor Unit.', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Valor Total', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Observação', style: 'tableHeader', fillColor: '#dddddd' },
    ];

    const tableFooter: TableCell[] = [
      {
        text: `TOTAL DE ITENS: ${ordem.itens.length}`,
        colSpan: 6,
        bold: true,
        alignment: 'left',
        margin: [0, 4],
        fillColor: '#dddddd',
      },
      '',
      '',
      '',
      '',
      '',
      {
        text: convertSalaryToPtBrCurrency(valorTotalOrdem),
        bold: true,
        alignment: 'right',
        margin: [0, 4],
        fillColor: '#dddddd',
      },
      { text: '', fillColor: '#dddddd' },
    ];

    itensArray.unshift(tableHeader);
    itensArray.push(tableFooter);

    return itensArray;
  }

  private gerarConteudoTableRelatorioPorIndicantes(
    indicante: IFornecedor,
    secretarias: ISecretaria[],
    pessoas: IPessoa[]
  ): TableCell[] {
    const secretariaMap = new Map<ISecretaria['id'], ISecretaria['nome']>(
      secretarias.map(s => [s.id, s.nome])
    );

    let totalSalario = 0;

    const indicantesArray: TableCell[] = pessoas
      .filter(p => p.indicante === indicante.id)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((pessoa, idx) => {
        // rega para fazer o zebrado de cores na tabela
        const fillColor = idx % 2 !== 0 ? '#f1f1f1' : null;

        totalSalario += pessoa.salario || 0;

        return [
          {
            text: (idx + 1).toString(),
            alignment: 'center',
            bold: true,
            margin: [0, 1],
            fillColor,
          },
          { text: pessoa.nome, alignment: 'left', margin: [0, 1], fillColor },
          { text: pessoa.funcao, alignment: 'left', margin: [0, 1], fillColor },
          {
            text: secretariaMap.get(pessoa.secretaria) || 'Não informado',
            alignment: 'left',
            margin: [0, 1],
            fillColor,
          },
          {
            text: pessoa.lotacao,
            alignment: 'left',
            margin: [0, 1],
            fillColor,
          },
          {
            text: convertSalaryToPtBrCurrency(pessoa.salario),
            alignment: 'left',
            margin: [0, 1],
            fillColor,
          },
          {
            text: getTipoContratoByValue(pessoa.tipoContrato),
            alignment: 'center',
            margin: [0, 1],
            fillColor,
          },
          {
            text: formatWorkload(pessoa.cargaHoraria),
            alignment: 'center',
            margin: [0, 1],
            fillColor,
          },
        ];
      });

    const tableHeader: TableCell[] = [
      { text: '#', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Nome', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Função', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Secretaria', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Unidade', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Vencimento', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Tipo Contrato', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'CH', style: 'tableHeader', fillColor: '#dddddd' },
    ];

    const [tableFooter1, tableFooter2]: TableCell[][] = [
      [
        {
          text: `TOTAL PESSOAS: ${indicantesArray.length}`,
          colSpan: 5,
          rowSpan: 2,
          bold: true,
          alignment: 'left',
          margin: [0, 11],
          fillColor: '#dddddd',
        },
        { text: '', alignment: 'center', margin: [0, 1], fillColor: '#dddddd' },
        {
          text: '',
          bold: true,
          alignment: 'center',
          margin: [0, 1],
          fillColor: '#dddddd',
        },
        {
          text: '',
          bold: true,
          alignment: 'center',
          margin: [0, 1],
          fillColor: '#dddddd',
        },
        {
          text: '',
          bold: true,
          alignment: 'center',
          margin: [0, 1],
          fillColor: '#dddddd',
        },
        {
          text: `MÉDIA VENCIMENTOS: ${convertSalaryToPtBrCurrency(totalSalario / (indicantesArray.length === 0 ? 1 : indicantesArray.length))}`,
          colSpan: 3,
          bold: true,
          alignment: 'left',
          margin: [0, 1],
          fillColor: '#dddddd',
        },
        {
          text: '',
          bold: true,
          alignment: 'center',
          margin: [0, 1],
          fillColor: '#dddddd',
        },
        {
          text: '',
          bold: true,
          alignment: 'center',
          margin: [0, 1],
          fillColor: '#dddddd',
        },
      ],
      [
        { text: '', colSpan: 4, margin: [0, 1], fillColor: '#dddddd' },
        {},
        {},
        {},
        {},
        {
          text: `TOTAL VENCIMENTOS: ${convertSalaryToPtBrCurrency(totalSalario)}`,
          colSpan: 3,
          bold: true,
          alignment: 'left',
          margin: [0, 1],
          fillColor: '#dddddd',
        },
        {},
        {},
      ],
    ];

    indicantesArray.unshift(tableHeader);
    indicantesArray.push(tableFooter1, tableFooter2);

    return indicantesArray;
  }

  private gerarConteudoTableRelatorioIndicantes = (
    indicantes: IFornecedor[],
    secretarias: ISecretaria[],
    pessoas: IPessoa[]
  ): TableCell[] => {
    const indicantesMap = new Map<IFornecedor['id'], IIndicanteMap>(
      indicantes.map(i => [i.id, { nomeIndicante: i.nome, secretarias: [] }])
    );

    const secretariaMap = new Map<ISecretaria['id'], ISecretaria['nome']>(
      secretarias.map(s => [s.id, s.nome])
    );

    pessoas.forEach(pessoa => {
      const indicante = indicantesMap.get(pessoa.indicante);
      // adicionar lógica caso não haja indicante (adicionar ainda)
      if (!indicante) return;

      const indexSecretaria = indicante.secretarias.findIndex(
        sec => sec.secretaria.id === pessoa.secretaria
      );

      if (indexSecretaria !== -1) {
        indicante.secretarias[indexSecretaria].qtdPessoas += 1;
      } else {
        indicante.secretarias.push({
          secretaria: {
            id: pessoa.secretaria,
            nome: secretariaMap.get(pessoa.secretaria) || 'Não informado',
            lotacoes: [],
          },
          qtdPessoas: 1,
        });
      }
    });

    let qtdPessoasTotal = 0;

    const indicantesArray = Array.from(indicantesMap.values())
      .sort((a, b) => a.nomeIndicante.localeCompare(b.nomeIndicante))
      .map((ind, idxIndicante) => {
        // Se não tiver pessoas associadas ao indicante, então irá adicionar apenas um registro como N/A
        if (ind.secretarias.length === 0) {
          ind.secretarias.push({
            secretaria: {
              nome: 'N/A',
            },
            qtdPessoas: 0,
          } as IIndicanteSecretariaMap);
        }

        const rows: TableCell[] = ind.secretarias
          .sort((a, b) => a.secretaria.nome.localeCompare(b.secretaria.nome))
          .map((sec, idx) => {
            const qtdSecretarias = ind.secretarias.length;
            const qtdPessoasIndicante = ind.secretarias.reduce(
              (acc, curr) => acc + curr.qtdPessoas,
              0
            );

            // regra para centralizar verticalmente
            const marginTop =
              qtdSecretarias === 1 ? 1 : (qtdSecretarias - 1) * 10;

            // rega para fazer o zebrado de cores na tabela
            const fillColor = idxIndicante % 2 !== 0 ? '#f1f1f1' : null;

            if (idx === 0) {
              qtdPessoasTotal += qtdPessoasIndicante;
              return [
                {
                  fillColor,
                  text: (idxIndicante + 1).toString(),
                  rowSpan: qtdSecretarias,
                  margin: [0, marginTop],
                  alignment: 'center',
                  bold: true,
                },
                {
                  fillColor,
                  text: ind.nomeIndicante,
                  rowSpan: qtdSecretarias,
                  margin: [0, marginTop],
                  alignment: 'left',
                },
                {
                  fillColor,
                  text: sec.secretaria.nome,
                  margin: [0, 1],
                  alignment: 'left',
                },
                {
                  fillColor,
                  text: sec.qtdPessoas.toString(),
                  margin: [0, 1],
                  alignment: 'center',
                },
                {
                  fillColor,
                  text: qtdPessoasIndicante.toString(),
                  rowSpan: qtdSecretarias,
                  margin: [0, marginTop],
                  alignment: 'center',
                },
              ];
            } else {
              return [
                '',
                '',
                {
                  text: sec.secretaria.nome,
                  margin: [0, 1],
                  alignment: 'left',
                  fillColor,
                },
                {
                  text: sec.qtdPessoas.toString(),
                  margin: [0, 1],
                  alignment: 'center',
                  fillColor,
                },
                '',
              ];
            }
          });
        return rows;
      })
      .flatMap(rows => rows);

    const tableHeader: TableCell[] = [
      { text: '#', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Indicante', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Secretaria', style: 'tableHeader', fillColor: '#dddddd' },
      { text: 'Qtd. Pessoas', style: 'tableHeader', fillColor: '#dddddd' },
      {
        text: 'Total p/ Indicante',
        style: 'tableHeader',
        fillColor: '#dddddd',
      },
    ];

    const tableFooter: TableCell[] = [
      {
        text: 'TOTAL',
        bold: true,
        colSpan: 3,
        alignment: 'center',
        margin: [0, 1],
        fillColor: '#dddddd',
      },
      '',
      '',
      {
        text: qtdPessoasTotal.toString(),
        bold: true,
        colSpan: 2,
        alignment: 'center',
        margin: [0, 1],
        fillColor: '#dddddd',
      },
      '',
    ];

    indicantesArray.unshift(tableHeader);
    indicantesArray.push(tableFooter);

    return indicantesArray;
  };

  private createDefaultHeader(
    text: string,
    dateText?: string
  ): TDocumentDefinitions['content'][] {
    return [
      { text, style: 'header' },
      {
        text: dateText ?? `Data de emissão: ${createDateTimeNowPtBr(true)}`,
        alignment: 'center',
        margin: [0, 0, 0, 5],
      },
    ];
  }

  private createDefaultTable(
    widths: (string | number)[],
    body?: TableCell[]
  ): TDocumentDefinitions['content'] {
    const table = {
      table: {
        headerRows: 1,
        widths,
        body: body ?? [],
      } as Table,
      layout: PDFMAKE_TABLE_LAYOUT,
    };
    return table;
  }

  private createPdfBlob(docDefinition: TDocumentDefinitions): Promise<Blob> {
    return new Promise((resolve, _) => {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.getBlob((blob: Blob) => resolve(blob));
    });
  }
}
