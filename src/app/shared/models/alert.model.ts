import { EAlertType } from '../enums/alert.enum';

export type IAlertType = `${EAlertType}`;

export interface IAlertConfig {
  type: IAlertType;
  title?: string;
  message: string;
  dismissible?: boolean;
  autoClose?: boolean;
  autoCloseTime?: number;
  id?: string;
}

export interface IAlert extends IAlertConfig {
  id: string;
  show: boolean;
}
