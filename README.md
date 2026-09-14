# Projeto White Label - Angular 19 

## 🎯 Sobre Este Projeto

Este é um **projeto White Label** desenvolvido como base para outros projetos `-app` da organização. Foi criado originalmente a partir do SGP (Sistema de Gestão de Pessoas) e adaptado para servir como template reutilizável através de forks.

### 📦 Conceito White Label

O projeto funciona como um **template base** que pode ser clonado e customizado para diferentes clientes/projetos. Ele inclui uma estrutura completa de aplicação Angular 19 com funcionalidades essenciais já implementadas.

### 🔄 Como Usar Este Template

1. **Fork do Repositório**: Crie um fork deste projeto para iniciar um novo projeto
2. **Customização**: Ajuste branding, funcionalidades e configurações para o cliente específico
3. **Deploy Independente**: Cada fork terá seu próprio deploy e configurações Firebase

Aplicação completa desenvolvida em Angular 19 com Firebase Realtime Database e Authentication, pronta para ser adaptada às necessidades específicas de cada projeto.

## 🚀 Tecnologias Utilizadas

- **Angular 19** - Framework principal
- **Firebase Authentication** - Sistema de autenticação
- **Firebase Realtime Database** - Banco de dados em tempo real
- **Bootstrap 5.3** - Framework CSS
- **Chart.js** - Gráficos interativos
- **Font Awesome** - Ícones
- **TypeScript** - Linguagem de programação

## 📋 Funcionalidades

### 🔐 Autenticação

- Login com email e senha
- Proteção de rotas com guards
- Persistência de sessão
- Logout seguro

### 📊 Dashboard

- Cards com estatísticas em tempo real
- Gráfico de barras: Pessoas por Indicante
- Gráfico de pizza: Pessoas por Secretaria
- Tabela das últimas pessoas cadastradas
- Atualização automática dos dados

### 👥 Gestão de Pessoas

- CRUD completo (Create, Read, Update, Delete)
- Campos: Nome, Telefone, Data de Início, Indicante, Secretaria, Tipo de Contrato, Salário, Endereço
- Filtros relacionados por Indicante e Secretaria
- Busca por nome, telefone ou endereço
- Validação de formulários
- Modal para cadastro/edição

### 🏢 Gestão de Indicantes

- CRUD completo
- Validação para evitar exclusão quando há pessoas vinculadas
- Busca por nome

### 🏛️ Gestão de Secretarias

- CRUD completo
- Validação para evitar exclusão quando há pessoas vinculadas
- Busca por nome

### 🎨 Interface

- Design moderno e responsivo
- Sidebar colapsável
- Tema com gradientes
- Animações suaves
- Compatível com desktop, tablet e mobile

## ⚙️ Configuração do Firebase

### 1. Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Siga as instruções para criar o projeto

### 2. Configurar Authentication

1. No console do Firebase, vá para "Authentication"
2. Clique em "Começar"
3. Na aba "Sign-in method", habilite "Email/senha"

### 3. Configurar Realtime Database

1. No console do Firebase, vá para "Realtime Database"
2. Clique em "Criar banco de dados"
3. Escolha o local (recomendado: us-central1)
4. Comece no modo de teste (você pode ajustar as regras depois)

### 4. Obter Credenciais

1. Vá para "Configurações do projeto" (ícone de engrenagem)
2. Na aba "Geral", role até "Seus apps"
3. Clique em "Adicionar app" e escolha "Web"
4. Registre o app e copie as credenciais

### 5. Configurar no Projeto

Edite os arquivos de ambiente com suas credenciais:

**src/environments/environment.ts:**

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'sua-api-key',
    authDomain: 'seu-projeto.firebaseapp.com',
    databaseURL: 'https://seu-projeto-default-rtdb.firebaseio.com/',
    projectId: 'seu-projeto-id',
    storageBucket: 'seu-projeto.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef123456',
    measurementId: 'G-XXXXXXXXXX',
  },
};
```

**src/environments/environment.prod.ts:**

```typescript
export const environment = {
  production: true,
  firebase: {
    // Mesmas credenciais do environment.ts
  },
};
```

## 🛠️ Instalação e Execução

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Angular CLI 19+

### Passos para instalação

1. **Instalar dependências:**

```bash
npm install
```

2. **Configurar Firebase:**
   - Edite os arquivos de ambiente conforme instruções acima

3. **Executar em desenvolvimento:**

```bash
ng serve
```

4. **Acessar aplicação:**
   - Abra o navegador em `http://localhost:4200`

5. **Build para produção:**

```bash
ng build --configuration production
```

## 👤 Primeiro Acesso

### Criar Usuário Administrador

Como o sistema usa Firebase Authentication, você precisa criar o primeiro usuário:

1. **Opção 1 - Via Firebase Console:**
   - Vá para Authentication > Users
   - Clique em "Adicionar usuário"
   - Insira email e senha

2. **Opção 2 - Habilitar registro temporariamente:**
   - Modifique temporariamente a tela de login para incluir registro
   - Crie sua conta
   - Remova a funcionalidade de registro

### Credenciais de Exemplo

Para testes, você pode criar um usuário com:

- **Email:** admin@sistema.com
- **Senha:** admin123

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── components/           # Componentes da aplicação
│   │   ├── login/           # Componente de login
│   │   ├── layout/          # Layout principal com sidebar
│   │   ├── dashboard/       # Dashboard com gráficos
│   │   ├── pessoas/         # CRUD de pessoas
│   │   ├── indicantes/      # CRUD de indicantes
│   │   └── secretarias/     # CRUD de secretarias
│   ├── services/            # Serviços
│   │   ├── auth.service.ts  # Serviço de autenticação
│   │   └── data.service.ts  # Serviço de dados
│   ├── guards/              # Guards de rota
│   │   └── auth.guard.ts    # Guard de autenticação
│   ├── models/              # Interfaces e modelos
│   │   └── interfaces.ts    # Interfaces TypeScript
│   └── app.routes.ts        # Configuração de rotas
├── environments/            # Configurações de ambiente
├── styles.css              # Estilos globais
└── index.html              # Página principal
```

## 🎨 Customização para Novos Projetos

Ao criar um fork deste projeto white label para um novo cliente:

1. **Branding**: Ajuste cores, logos e identidade visual em `src/styles.css`
2. **Firebase**: Configure novas credenciais em `src/environments/`
3. **Funcionalidades**: Adicione ou remova módulos conforme necessário
4. **Nomenclaturas**: Adapte termos como "pessoas", "secretarias" para o contexto do cliente
5. **Deploy**: Configure novo projeto no Vercel/Firebase Hosting

### 📝 Checklist de Customização

- [ ] Alterar nome do projeto em `package.json` e `angular.json`
- [ ] Configurar novas credenciais Firebase
- [ ] Ajustar cores e branding
- [ ] Revisar e adaptar funcionalidades
- [ ] Configurar domínio customizado
- [ ] Atualizar documentação específica do projeto

## 🚀 Deploy

### Netlify/Vercel

1. Faça build do projeto: `ng build --configuration production`
2. Faça upload da pasta `dist/`

### Firebase Hosting

1. Instale Firebase CLI: `npm install -g firebase-tools`
2. Faça login: `firebase login`
3. Inicialize: `firebase init hosting`
4. Deploy: `firebase deploy`

## 📝 Estrutura do Banco de Dados

O Firebase Realtime Database será estruturado automaticamente:

```json
{
  "pessoas": {
    "id1": {
      "nome": "João Silva",
      "telefone": "(11) 99999-9999",
      "dataInicio": "2024-01-15",
      "indicante": "Maria Santos",
      "secretaria": "Secretaria de Saúde",
      "tipoContrato": "CLT",
      "salario": 5000,
      "endereco": "Rua das Flores, 123",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "indicantes": {
    "id1": {
      "nome": "Maria Santos",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "secretarias": {
    "id1": {
      "nome": "Secretaria de Saúde",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

## 🔒 Regras de Segurança do Firebase

Para produção, configure as regras do Realtime Database:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## 🐛 Solução de Problemas

### Erro de CORS

Se encontrar erros de CORS, verifique:

- As configurações do Firebase
- Se o domínio está autorizado no Firebase Console

### Erro de Autenticação

- Verifique se o Authentication está habilitado
- Confirme se o método Email/Senha está ativo
- Verifique as credenciais nos arquivos de ambiente

### Erro de Database

- Confirme se o Realtime Database está criado
- Verifique a URL do database nas configurações
- Confirme se as regras permitem leitura/escrita

## � Documentações

### Serviços e Componentes

- **[MobileDeviceService](docs/MOBILE_DEVICE.MD)** - Serviço para detecção de dispositivos móveis e controle de responsividade

### Guias Técnicos

- **[Z-Index Layers](docs/Z_INDEX_LAYERS.md)** - Documentação dos valores de z-index e hierarquia de sobreposição de elementos

- **[Implementação PDF Modal](docs/IMPLEMENTACAO_PDF_MODAL.md)** - Documentação da implementação do modal de PDF

- **[Validação de Telefone](docs/VALIDACAO_TELEFONE.md)** - Documentação completa da implementação de máscara e validação de telefone

- **[Configuração e Regras do Firebase](docs/FIREBASE_REGRAS_E_CONFIG.md)** - Guia para criar o projeto Firebase, ativar Realtime Database, regras e Authentication

- **[Regras de Segurança Firebase](docs/FIREBASE_SECURITY_RULES.md)** - Regras avançadas de segurança, validação de dados, controle de acesso e auditoria para Firebase

- **[Sanitização de Dados Firebase](docs/FIREBASE_SANITIZATION.md)** - Funções para remover propriedades undefined e prevenir erros do Firebase

- **[Configuração de Environments](docs/ENVIRONMENTS_CONFIG.md)** - Documentação completa sobre configuração e uso de environments (desenvolvimento e produção)

- **[Configuração de Deploy Angular + Functions](docs/DEPLOYMENT_VERCEL.md)** - Documentação completa sobre configuração e uso de environments (desenvolvimento e produção)

Documentações técnicas detalhadas sobre a implementação e uso dos componentes do sistema.

## �📞 Suporte

Para dúvidas ou problemas:

1. Verifique a documentação do Angular: https://angular.io/docs
2. Consulte a documentação do Firebase: https://firebase.google.com/docs
3. Verifique os logs do console do navegador
4. Consulte as documentações técnicas na seção [Documentações](#-documentações)

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---

## **Desenvolvido com ❤️ usando Angular 19 e Firebase**

-
