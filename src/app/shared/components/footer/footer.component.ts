import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { version } from '../../../../../package.json';

@Component({
  standalone: true,
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  imports: [CommonModule],
})
export class FooterComponent {
  @Input() collapsed: boolean = false;
  @Input() isMobile: boolean | null = false;
  @Input() sidebarVisible: boolean | null = false;

  public readonly version = version;
}
