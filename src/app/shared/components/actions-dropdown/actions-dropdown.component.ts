import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from '@angular/core';
import { IActionDropdownItem } from '../../models/actions-dropdown.model';

declare var bootstrap: any;

@Component({
  selector: 'app-actions-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './actions-dropdown.component.html',
  styleUrl: './actions-dropdown.component.css',
})
export class ActionsDropdownComponent implements AfterViewInit {
  @Input() public actions: IActionDropdownItem[] = [];
  @Input() public title = 'Ações';

  @ViewChild('dropdownToggle')
  public dropdownToggle!: ElementRef<HTMLButtonElement>;

  public get visibleActions(): IActionDropdownItem[] {
    return this.actions.filter(action => !action.hidden);
  }

  public ngAfterViewInit(): void {
    // usa position: fixed para o menu não ser cortado por containers
    // com overflow: hidden (ex.: .table-container)
    new bootstrap.Dropdown(this.dropdownToggle.nativeElement, {
      popperConfig: (defaultConfig: any) => ({
        ...defaultConfig,
        strategy: 'fixed',
      }),
    });
  }

  public onActionClick(action: IActionDropdownItem): void {
    if (action.disabled) return;
    action.onClick?.();
  }
}
