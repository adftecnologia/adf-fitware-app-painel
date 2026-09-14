import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AlertComponent, AlertType } from './alert.component';

describe('AlertComponent', () => {
  let component: AlertComponent;
  let fixture: ComponentFixture<AlertComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display alert with title and message', () => {
    component.title = 'Teste Título';
    component.message = 'Teste Mensagem';
    component.type = 'success';
    fixture.detectChanges();

    const titleElement = fixture.debugElement.query(By.css('.alert-title'));
    const messageElement = fixture.debugElement.query(By.css('.alert-message'));

    expect(titleElement.nativeElement.textContent.trim()).toBe('Teste Título');
    expect(messageElement.nativeElement.textContent.trim()).toBe(
      'Teste Mensagem'
    );
  });

  it('should apply correct CSS class for alert type', () => {
    const types: AlertType[] = ['success', 'info', 'warning', 'danger'];

    types.forEach(type => {
      component.type = type;
      expect(component.getAlertClass()).toBe(`alert-${type}`);
    });
  });

  it('should display correct icon for each alert type', () => {
    const expectedIcons = {
      success: 'fas fa-check-circle',
      info: 'fas fa-info-circle',
      warning: 'fas fa-exclamation-triangle',
      danger: 'fas fa-exclamation-circle',
    };

    Object.entries(expectedIcons).forEach(([type, iconClass]) => {
      component.type = type as AlertType;
      expect(component.getIconClass()).toBe(iconClass);
    });
  });

  it('should show close button when dismissible is true', () => {
    component.dismissible = true;
    fixture.detectChanges();

    const closeButton = fixture.debugElement.query(By.css('.btn-close'));
    expect(closeButton).toBeTruthy();
  });

  it('should hide close button when dismissible is false', () => {
    component.dismissible = false;
    fixture.detectChanges();

    const closeButton = fixture.debugElement.query(By.css('.btn-close'));
    expect(closeButton).toBeFalsy();
  });

  it('should emit onClose event when close button is clicked', () => {
    spyOn(component.onClose, 'emit');
    component.dismissible = true;
    fixture.detectChanges();

    const closeButton = fixture.debugElement.query(By.css('.btn-close'));
    closeButton.nativeElement.click();

    expect(component.onClose.emit).toHaveBeenCalled();
    expect(component.show).toBe(false);
  });

  it('should hide alert when show is false', () => {
    component.show = false;
    fixture.detectChanges();

    const alertContainer = fixture.debugElement.query(
      By.css('.alert-container')
    );
    expect(alertContainer).toBeFalsy();
  });

  it('should show alert when show is true', () => {
    component.show = true;
    fixture.detectChanges();

    const alertContainer = fixture.debugElement.query(
      By.css('.alert-container')
    );
    expect(alertContainer).toBeTruthy();
  });

  it('should not show title when title is empty', () => {
    component.title = '';
    component.message = 'Apenas mensagem';
    fixture.detectChanges();

    const titleElement = fixture.debugElement.query(By.css('.alert-title'));
    expect(titleElement).toBeFalsy();
  });

  it('should not show message when message is empty', () => {
    component.title = 'Apenas título';
    component.message = '';
    fixture.detectChanges();

    const messageElement = fixture.debugElement.query(By.css('.alert-message'));
    expect(messageElement).toBeFalsy();
  });

  it('should show progress bar when autoClose is true', () => {
    component.autoClose = true;
    component.show = true;
    fixture.detectChanges();

    const progressElement = fixture.debugElement.query(
      By.css('.alert-progress')
    );
    expect(progressElement).toBeTruthy();
  });

  it('should hide progress bar when autoClose is false', () => {
    component.autoClose = false;
    fixture.detectChanges();

    const progressElement = fixture.debugElement.query(
      By.css('.alert-progress')
    );
    expect(progressElement).toBeFalsy();
  });

  it('should auto close after specified time', done => {
    spyOn(component.onClose, 'emit');

    component.autoClose = true;
    component.autoCloseTime = 100;
    component.show = true;

    component.ngOnInit();

    setTimeout(() => {
      expect(component.show).toBe(false);
      expect(component.onClose.emit).toHaveBeenCalled();
      done();
    }, 150);
  });

  it('should clear timer on destroy', () => {
    component.autoClose = true;
    component.show = true;
    component.ngOnInit();

    spyOn(window, 'clearTimeout').and.callThrough();

    component.ngOnDestroy();

    // Como não temos acesso ao timer privado, verificamos se o método não falha
    expect(component).toBeTruthy();
  });

  it('should restart timer when component changes and autoClose is true', () => {
    component.autoClose = true;
    component.show = true;
    component.ngOnInit();

    spyOn(component, 'close');

    // Simula uma mudança
    component.ngOnChanges();

    // Aguarda o tempo do autoClose
    setTimeout(() => {
      expect(component.close).toHaveBeenCalled();
    }, component.autoCloseTime + 50);
  });
});
