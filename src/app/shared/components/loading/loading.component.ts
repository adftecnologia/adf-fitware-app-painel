import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.css',
})
export class LoadingComponent {
  @Input() public message: string = 'Verificando autenticação...';
  @Input() public showProgress: boolean = true;
  @Input() public showBrand: boolean = true;
}
