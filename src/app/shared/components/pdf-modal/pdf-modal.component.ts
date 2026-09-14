import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IDataReport } from '../../models/pdf-make.model';
import { PdfMakeService } from '../../services/pdf-make/pdf-make.service';
import { AlertService } from './../../services/alert-service/alert.service';

@Component({
  selector: 'app-pdf-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-modal.component.html',
  styleUrls: ['./pdf-modal.component.css'],
})
export class PdfModalComponent implements OnInit {
  @ViewChild('pdfIframe', { static: false })
  public pdfIframe!: ElementRef<HTMLIFrameElement>;

  private currentBlobUrl: string | null = null;

  public isVisible = false;
  public pdfUrl: SafeResourceUrl | null = null;
  public isLoading = false;
  public dataReport: IDataReport = {
    reportName: 'relatorio',
    title: 'Relatório',
  };

  constructor(
    private readonly sanitizer: DomSanitizer,
    private readonly pdfMakeService: PdfMakeService,
    private readonly alertService: AlertService
  ) {}

  public ngOnInit(): void {
    this.initializeEvents();
  }

  private initializeEvents(): void {
    this.pdfMakeService.isVisible$.subscribe(
      (visible: boolean) => (this.isVisible = visible)
    );

    this.pdfMakeService.pdfBlob$.subscribe((blob: Blob | null) => {
      if (blob) {
        this.loadPdfFromBlob(blob);
      }
    });

    this.pdfMakeService.isLoading$.subscribe(
      (loading: boolean) => (this.isLoading = loading)
    );

    this.pdfMakeService.dataReport$.subscribe(data => (this.dataReport = data));
  }

  private loadPdfFromBlob(blob: Blob): void {
    // Limpar URL anterior se existir
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
    }

    // Criar nova URL do blob
    this.currentBlobUrl = URL.createObjectURL(blob);
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.currentBlobUrl
    );
  }

  public onPrint(): void {
    try {
      if (this.pdfIframe?.nativeElement?.contentWindow) {
        // Tentar imprimir através do iframe
        this.pdfIframe.nativeElement.contentWindow.print();

        // // Detectar quando a impressão é concluída (funciona na maioria dos navegadores)
        // const iframe = this.pdfIframe.nativeElement;

        // // Método 1: Detectar foco voltando para a janela principal
        // const detectPrintEnd = () => {
        //   setTimeout(() => {
        //     this.closeModal();
        //   }, 500); // Pequeno delay para garantir que a impressão foi processada
        // };

        // // Método 2: Event listener para mudanças de foco
        // iframe.contentWindow?.addEventListener('afterprint', detectPrintEnd);

        // // Fallback: fechar após um tempo se não detectar o evento
        // setTimeout(() => {
        //   detectPrintEnd();
        // }, 3000);
      } else {
        // Fallback: abrir em nova janela para impressão
        if (this.currentBlobUrl) {
          const printWindow = window.open(this.currentBlobUrl, '_blank');

          if (printWindow) {
            printWindow.onload = () => {
              printWindow.print();
              printWindow.onafterprint = () => {
                printWindow.close();
                this.closeModal();
              };
            };
          }
        }
      }
    } catch (error) {
      this.alertService.error('Erro ao imprimir PDF', 'Aviso', {
        autoClose: false,
      });
      console.error('Erro ao imprimir PDF:', error);
      // Fallback manual
      if (this.currentBlobUrl) {
        window.open(this.currentBlobUrl, '_blank');
      }
    }
  }

  public onDownload(): void {
    if (this.currentBlobUrl) {
      const link = document.createElement('a');

      link.href = this.currentBlobUrl;
      link.download = `${this.dataReport.reportName}_${new Date().toISOString().split('T')[0]}.pdf`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);
    }
  }

  public closeModal(): void {
    this.pdfMakeService.closeModal();

    // Limpar recursos
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.pdfUrl = null;
  }

  // Fechar modal clicando no backdrop
  public onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  // Fechar com ESC
  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal();
    }
  }
}
