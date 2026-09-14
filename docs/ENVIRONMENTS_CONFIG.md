# Configuração de Environments - Projeto White Label

Este documento descreve como configurar e utilizar os diferentes environments (ambientes) no projeto white label Angular.

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Estrutura de Arquivos](#-estrutura-de-arquivos)
- [Configuração do Angular.json](#-configuração-do-angularjson)
- [Como Usar](#-como-usar)
- [Exemplos de Configuração](#-exemplos-de-configuração)
- [Commands de Build](#-commands-de-build)
- [Boas Práticas](#-boas-práticas)

## 🎯 Visão Geral

O sistema utiliza diferentes arquivos de environment para configurar variáveis específicas de cada ambiente (desenvolvimento, produção, etc.). O Angular automaticamente substitui o arquivo base durante o processo de build.

## 📁 Estrutura de Arquivos

```
src/environments/
├── environment.ts      # Arquivo base (padrão)
├── environment.dev.ts  # Configurações de desenvolvimento
└── environment.prod.ts # Configurações de produção
```

### Descrição dos Arquivos

- **`environment.ts`**: Arquivo base usado como referência
- **`environment.dev.ts`**: Configurações específicas para desenvolvimento
- **`environment.prod.ts`**: Configurações específicas para produção

## ⚙️ Configuração do Angular.json

O arquivo `angular.json` foi configurado com `fileReplacements` para substituir automaticamente os environments:

### Configuração Production

```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  "budgets": [...],
  "outputHashing": "all"
}
```

### Configuração Development

```json
"development": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.dev.ts"
    }
  ],
  "optimization": false,
  "extractLicenses": false,
  "sourceMap": true
}
```

## 🚀 Como Usar

### No Código TypeScript

Importe sempre o arquivo base `environment.ts`:

```typescript
import { environment } from '../environments/environment';

// O Angular automaticamente usará o arquivo correto
console.log(
  'Environment:',
  environment.production ? 'Production' : 'Development'
);
console.log('API URL:', environment.apiUrl);
console.log('Firebase Config:', environment.firebase);
```

### Exemplo de Uso em Service

```typescript
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private isProduction = environment.production;

  constructor() {
    if (!this.isProduction) {
      console.log('Running in development mode');
    }
  }
}
```

## 📝 Exemplos de Configuração

### environment.dev.ts (Desenvolvimento)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  firebase: {
    apiKey: 'dev-api-key',
    authDomain: 'projeto-dev.firebaseapp.com',
    databaseURL: 'https://projeto-dev-default-rtdb.firebaseio.com',
    projectId: 'projeto-dev',
    storageBucket: 'projeto-dev.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef123456',
  },
  enableLogging: true,
  debugMode: true,
};
```

### environment.prod.ts (Produção)

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.meudominio.com',
  firebase: {
    apiKey: 'prod-api-key',
    authDomain: 'projeto-prod.firebaseapp.com',
    databaseURL: 'https://projeto-prod-default-rtdb.firebaseio.com',
    projectId: 'projeto-prod',
    storageBucket: 'projeto-prod.appspot.com',
    messagingSenderId: '987654321',
    appId: '1:987654321:web:fedcba654321',
  },
  enableLogging: false,
  debugMode: false,
};
```

## 🔧 Commands de Build

### Para Desenvolvimento

```bash
# Serve em modo desenvolvimento (usa environment.dev.ts)
ng serve

# Build para desenvolvimento
ng build --configuration=development
```

### Para Produção

```bash
# Build para produção (usa environment.prod.ts)
ng build --configuration=production

# Ou simplesmente
ng build --prod
```

### Verificar Configuração Ativa

```bash
# Ver qual environment está sendo usado
ng build --configuration=development --verbose
ng build --configuration=production --verbose
```

## ✅ Boas Práticas

### 1. Segurança

- **Nunca** commite credenciais reais nos arquivos de environment
- Use variáveis de ambiente do sistema para dados sensíveis
- Mantenha arquivos de produção seguros

### 2. Organização

```typescript
// ✅ Bom: Estrutura organizada
export const environment = {
  production: false,
  api: {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
  },
  firebase: {
    /* configurações */
  },
  features: {
    enableAnalytics: false,
    enableNotifications: true,
  },
};
```

### 3. Validação

```typescript
// ✅ Bom: Validar configurações obrigatórias
if (!environment.firebase.apiKey) {
  throw new Error('Firebase API Key is required');
}
```

### 4. Documentação

- Documente todas as variáveis de environment
- Mantenha exemplos atualizados
- Explique o propósito de cada configuração

## 🔍 Troubleshooting

### Problema: Environment não está sendo substituído

**Solução**: Verifique se a configuração no `angular.json` está correta e se os caminhos dos arquivos estão corretos.

### Problema: Erro de import do environment

**Solução**: Sempre importe do arquivo base `environment.ts`, nunca diretamente dos arquivos específicos.

### Problema: Variáveis não definidas

**Solução**: Certifique-se de que todas as propriedades existem em todos os arquivos de environment.

## 📚 Referências

- [Angular Environments Documentation](https://angular.io/guide/build#configuring-application-environments)
- [Angular CLI Build Documentation](https://angular.io/cli/build)
- [Firebase Configuration](https://firebase.google.com/docs/web/setup)

---

**Data de Criação**: Outubro 2025  
**Última Atualização**: Outubro 2025  
**Versão**: 1.0
