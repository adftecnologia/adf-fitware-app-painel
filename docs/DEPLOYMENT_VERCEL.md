# 🚀 Deployment no Vercel - Projeto White Label

## 📋 Resumo

Este guia documenta o processo de deployment do projeto white label (Angular + API) no Vercel, incluindo a resolução de problemas comuns.

## 🏗️ Arquitetura do Projeto

### Estrutura de Build

```
dist/
├── api/                    # TypeScript API compilada
│   ├── usuarios/
│   ├── auth/
│   └── index.js
└── adf-adftecnologia-app-whitelabel/
    └── browser/           # Angular build (IMPORTANTE!)
        ├── index.html
        ├── main.js
        └── assets/
```

### Problema Resolvido: Angular não carregava

**Situação:** Apenas as functions da API funcionavam, o site Angular não carregava.

**Causa:** O `outputDirectory` no `vercel.json` apontava para o diretório errado.

**Solução:** Angular 19 gera o build em um subdiretório `browser/`:

```json
{
  "outputDirectory": "dist/adf-adftecnologia-app-whitelabel/browser"
}
```

## ⚙️ Configuração de Deployment

### 1. vercel.json

```json
{
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "dist/adf-adftecnologia-app-whitelabel/browser",
  "framework": null,
  "functions": {
    "api/**/*.js": {
      "runtime": "@vercel/node@5.4.1"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET,POST,PUT,DELETE,OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

### 2. package.json - Scripts

```json
{
  "scripts": {
    "build:vercel": "node build-vercel.js",
    "build:api": "tsc --project tsconfig.api.json",
    "build:angular": "ng build --configuration production"
  }
}
```

### 3. Build Script Inteligente

O `build-vercel.js` detecta automaticamente o ambiente e realiza:

- Compilação TypeScript da API
- Build do Angular com configuração apropriada
- Verificação da estrutura de diretórios
- Relatório detalhado do build

## 🔧 Resolução de Problemas

### Problema 1: "Cannot use import statement outside a module"

**Solução:** Configurar `tsconfig.api.json` com:

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2020"
  }
}
```

### Problema 2: Conflitos de dependências Angular

**Solução:** Adicionar ao `package.json`:

```json
{
  "overrides": {
    "@angular/core": "^19.0.0",
    "@angular/common": "^19.0.0",
    "@angular/forms": "^19.0.0"
  }
}
```

### Problema 3: Site não carrega (apenas API funciona)

**Solução:** Corrigir `outputDirectory` no `vercel.json`:

```json
{
  "outputDirectory": "dist/adf-adftecnologia-app-whitelabel/browser"
}
```

## 🚦 Checklist de Deployment

### Antes do Deploy

- [ ] Dependências atualizadas (`npm install`)
- [ ] Build local funcionando (`npm run build:vercel`)
- [ ] Verificar estrutura em `dist/adf-adftecnologia-app-whitelabel/browser/`
- [ ] Confirmar `index.html` no diretório correto

### Configurações Vercel

- [ ] `outputDirectory` aponta para `/browser`
- [ ] Functions configuradas para `@vercel/node@5.4.1`
- [ ] Rewrites configurados para API e SPA
- [ ] Headers CORS configurados

### Após Deploy

- [ ] Site Angular carrega na URL principal
- [ ] API endpoints funcionam em `/api/*`
- [ ] CORS funcionando para requests cross-origin
- [ ] Console sem erros 404

## 📊 Estrutura de URLs

### Produção

- **Site:** `https://seu-projeto.vercel.app/`
- **API:** `https://seu-projeto.vercel.app/api/usuarios`
- **Health:** `https://seu-projeto.vercel.app/api/health`

### Local

- **Site:** `http://localhost:4200/`
- **API:** Não aplicável (usar Firebase local)

## 🔄 Comandos Úteis

```bash
# Build completo
npm run build:vercel

# Build apenas API
npm run build:api

# Build apenas Angular
npm run build:angular

# Verificar estrutura de build
ls -la dist/adf-adftecnologia-app-whitelabel/browser/

# Deploy manual
vercel --prod
```

## 📝 Notas Importantes

1. **Angular 19:** Sempre gera build em subdiretório `browser/`
2. **TypeScript API:** Compilada para CommonJS para compatibilidade Vercel
3. **Roteamento:** SPA routing configurado via rewrites
4. **CORS:** Configurado apenas para endpoints da API
5. **Environment:** Build script detecta automaticamente prod/dev

## 🎯 Próximos Passos

1. Configurar variáveis de ambiente no Vercel
2. Configurar domínio customizado
3. Implementar CI/CD com GitHub Actions
4. Monitoramento e analytics
5. Cache optimization

---

**Última atualização:** Janeiro 2025  
**Status:** ✅ Funcionando corretamente
