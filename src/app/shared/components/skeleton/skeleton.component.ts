import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.css'],
})
export class SkeletonComponent {
  @Input() width: string = '100%';
  @Input() height: string = '1rem';
  @Input() isVisible: boolean = true;
  @Input() animation: 'glow' | 'wave' | 'none' = 'glow';
  @Input() shape: 'default' | 'rounded' | 'circle' = 'default';
}
