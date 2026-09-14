import { Injectable } from '@angular/core';
import { ELocalStorage } from '../../enums/localstorage.enum';

@Injectable({
  providedIn: 'root',
})
export class LocalstorageService {
  public getItem<T>(
    key: ELocalStorage,
    parseToJson: boolean = false
  ): T | string | null {
    if (parseToJson) {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    }
    return localStorage.getItem(key);
  }

  public setItem<T>(key: ELocalStorage, value: T | string): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  public removeItem(key: ELocalStorage): void {
    localStorage.removeItem(key);
  }

  public clear(): void {
    localStorage.clear();
  }
}
