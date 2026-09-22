import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  EEtapaProvisionamento,
  EStatusEvento,
  IEtapaDescrita,
  IEventoProvisionamento,
} from '../../models/http.model';

/** Estado visual de uma linha da timeline. */
export enum EEstadoLinhaTimeline {
  SUCESSO = 'sucesso',
  ERRO = 'erro',
  /** Etapa que só pode ser concluída no console do Google. */
  MANUAL = 'manual',
  EM_ANDAMENTO = 'em-andamento',
  PENDENTE = 'pendente',
}

export interface ILinhaTimeline {
  chave: string;
  rotulo: string;
  estado: EEstadoLinhaTimeline;
  dataHora?: string;
  duracaoMs?: number;
  resumo?: string;
  erro?: string;
}

/**
 * Timeline vertical de etapas.
 *
 * Combina duas coisas numa lista só: as etapas *previstas* (que vêm do backend
 * e existem mesmo antes de rodar, para a tela já mostrar o caminho inteiro) e
 * os eventos *ocorridos* — inclusive as tentativas que falharam e foram
 * refeitas, que aparecem como linhas próprias.
 */
@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss'],
})
export class TimelineComponent {
  @Input() public historico: IEventoProvisionamento[] = [];

  /** Etapas previstas, na ordem de execução. Vazio mostra só o histórico. */
  @Input() public etapas: IEtapaDescrita[] = [];

  /** Etapa que está rodando agora, destacada com o marcador pulsante. */
  @Input() public etapaEmAndamento: EEtapaProvisionamento | null = null;

  public readonly EEstadoLinhaTimeline = EEstadoLinhaTimeline;

  public get linhas(): ILinhaTimeline[] {
    const eventos = this.historico ?? [];

    const linhasOcorridas: ILinhaTimeline[] = eventos.map((evento, indice) => ({
      // A mesma etapa pode aparecer mais de uma vez (falhou, foi refeita), por
      // isso o índice entra na chave — sem ele o *ngFor reaproveitaria a linha.
      chave: `${evento.etapa}-${indice}`,
      rotulo: this.rotuloDe(evento.etapa),
      estado: this.estadoDoEvento(evento.status),
      dataHora: evento.dataHora,
      duracaoMs: evento.duracaoMs,
      resumo: evento.resumo,
      erro: evento.erro,
    }));

    const jaConcluidas = new Set(
      eventos
        .filter(evento => evento.status === EStatusEvento.SUCESSO)
        .map(evento => evento.etapa)
    );

    const linhasPendentes: ILinhaTimeline[] = (this.etapas ?? [])
      .filter(({ etapa }) => !jaConcluidas.has(etapa))
      .map(({ etapa, rotulo }) => ({
        chave: `pendente-${etapa}`,
        rotulo,
        estado:
          etapa === this.etapaEmAndamento
            ? EEstadoLinhaTimeline.EM_ANDAMENTO
            : EEstadoLinhaTimeline.PENDENTE,
      }));

    return [...linhasOcorridas, ...linhasPendentes];
  }

  /**
   * `linhas` é recalculado a cada ciclo de detecção de mudanças, então sem
   * trackBy o Angular recriaria todas as linhas do DOM a cada etapa.
   */
  public trackByChave(_indice: number, linha: ILinhaTimeline): string {
    return linha.chave;
  }

  public iconeDe(estado: EEstadoLinhaTimeline): string {
    switch (estado) {
      case EEstadoLinhaTimeline.SUCESSO:
        return 'fas fa-check';
      case EEstadoLinhaTimeline.ERRO:
        return 'fas fa-times';
      case EEstadoLinhaTimeline.MANUAL:
        return 'fas fa-hand-pointer';
      case EEstadoLinhaTimeline.EM_ANDAMENTO:
        return 'fas fa-spinner fa-spin';
      default:
        return 'far fa-circle';
    }
  }

  private estadoDoEvento(status: EStatusEvento): EEstadoLinhaTimeline {
    switch (status) {
      case EStatusEvento.ERRO:
        return EEstadoLinhaTimeline.ERRO;
      case EStatusEvento.MANUAL:
        return EEstadoLinhaTimeline.MANUAL;
      default:
        return EEstadoLinhaTimeline.SUCESSO;
    }
  }

  public formatarDuracao(duracaoMs?: number): string {
    if (!duracaoMs) {
      return '';
    }

    return duracaoMs < 1000
      ? `${duracaoMs} ms`
      : `${(duracaoMs / 1000).toFixed(1)} s`;
  }

  private rotuloDe(etapa: EEtapaProvisionamento): string {
    return (
      (this.etapas ?? []).find(item => item.etapa === etapa)?.rotulo ?? etapa
    );
  }
}
