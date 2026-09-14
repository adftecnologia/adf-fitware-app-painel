import { TestBed } from '@angular/core/testing';
import { AlertService } from './alert.service';
import { IAlertConfig } from '../../models/alert.model';
import { EAlertType } from '../../enums/alert.enum';

describe('AlertService', () => {
  let service: AlertService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AlertService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show success alert', () => {
    const id = service.success('Sucesso!', 'Operação realizada');
    const alerts = service.alerts;

    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('success');
    expect(alerts[0].message).toBe('Sucesso!');
    expect(alerts[0].title).toBe('Operação realizada');
    expect(alerts[0].id).toBe(id);
  });

  it('should show info alert', () => {
    service.info('Informação importante');
    const alerts = service.alerts;

    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('info');
    expect(alerts[0].message).toBe('Informação importante');
  });

  it('should show warning alert', () => {
    service.warning('Atenção!', 'Cuidado');
    const alerts = service.alerts;

    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('warning');
    expect(alerts[0].message).toBe('Atenção!');
    expect(alerts[0].title).toBe('Cuidado');
  });

  it('should show error alert with default title', () => {
    service.error('Algo deu errado');
    const alerts = service.alerts;

    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('danger');
    expect(alerts[0].message).toBe('Algo deu errado');
    expect(alerts[0].title).toBe('Erro');
  });

  it('should close specific alert', () => {
    const id1 = service.success('Alerta 1');
    const id2 = service.info('Alerta 2');

    expect(service.alerts.length).toBe(2);

    service.close(id1);
    expect(service.alerts.length).toBe(1);
    expect(service.alerts[0].id).toBe(id2);
  });

  it('should close all alerts', () => {
    service.success('Alerta 1');
    service.info('Alerta 2');
    service.warning('Alerta 3');

    expect(service.alerts.length).toBe(3);

    service.closeAll();
    expect(service.alerts.length).toBe(0);
  });

  it('should close alerts by type', () => {
    service.success('Sucesso 1');
    service.success('Sucesso 2');
    service.info('Info 1');
    service.error('Erro 1');

    expect(service.alerts.length).toBe(4);

    service.closeByType('success');
    expect(service.alerts.length).toBe(2);
    expect(service.alerts.every(a => a.type !== 'success')).toBe(true);
  });

  it('should check if has alerts', () => {
    expect(service.hasAlerts()).toBe(false);

    service.info('Teste');
    expect(service.hasAlerts()).toBe(true);

    service.closeAll();
    expect(service.hasAlerts()).toBe(false);
  });

  it('should check if has alert of specific type', () => {
    service.success('Sucesso');
    service.info('Info');

    expect(service.hasAlertOfType('success')).toBe(true);
    expect(service.hasAlertOfType('warning')).toBe(false);
  });

  it('should get alert by id', () => {
    const id = service.error('Erro teste');
    const alert = service.getAlert(id);

    expect(alert).toBeTruthy();
    expect(alert?.id).toBe(id);
    expect(alert?.type).toBe('danger');
  });

  it('should return undefined for non-existing alert', () => {
    const alert = service.getAlert('non-existing-id');
    expect(alert).toBeUndefined();
  });

  it('should handle custom alert config', () => {
    const config: IAlertConfig = {
      type: EAlertType.INFO,
      message: 'Mensagem customizada',
      title: 'Título custom',
      dismissible: false,
      autoClose: true,
      autoCloseTime: 3000,
    };

    service.show(config);
    const alerts = service.alerts;

    expect(alerts.length).toBe(1);
    expect(alerts[0].dismissible).toBe(false);
    expect(alerts[0].autoClose).toBe(true);
    expect(alerts[0].autoCloseTime).toBe(3000);
  });

  it('should auto close alert after specified time', done => {
    service.show({
      type: 'info',
      message: 'Auto close test',
      autoClose: true,
      autoCloseTime: 100,
    });

    expect(service.alerts.length).toBe(1);

    setTimeout(() => {
      expect(service.alerts.length).toBe(0);
      done();
    }, 150);
  });
});
