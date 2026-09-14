export interface IActionDropdownItem {
  label: string;
  icon: string;
  textClass?: string;
  disabled?: boolean;
  hidden?: boolean;
  dataBsToggle?: string;
  dataBsTarget?: string;
  onClick?: () => void;
}
