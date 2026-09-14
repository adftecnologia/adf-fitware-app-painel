import { CustomTableLayout, TDocumentDefinitions } from 'pdfmake/interfaces';

export const PDFMAKE_STYLES: TDocumentDefinitions['styles'] = {
  header: {
    fontSize: 14,
    bold: true,
    alignment: 'center',
    margin: [0, 10, 0, 5],
  },
  tableHeader: {
    bold: true,
    fontSize: 12,
    fillColor: '#eeeeee',
    alignment: 'center',
  },
};

export const PDFMAKE_TABLE_LAYOUT: CustomTableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => '#000000',
  vLineColor: () => '#000000',
};
