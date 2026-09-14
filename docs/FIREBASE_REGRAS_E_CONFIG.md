# Firebase — Regras e Configuração - Projeto White Label

Este documento descreve os passos mínimos para configurar o Firebase para este projeto white label Angular (Realtime Database + Authentication) e onde colocar as credenciais no projeto.

1. Criar projeto no Firebase

- Acesse https://console.firebase.google.com/
- Clique em "Adicionar projeto" (ou "Create project") e siga as instruções.
- Escolha um nome, aceite os termos e finalize.

2. Ativar Realtime Database

- No painel do projeto, clique em "Realtime Database" no menu lateral.
- Clique em "Criar banco de dados".
- Escolha o local (região) e o modo de início (por segurança, usar "modo bloqueado" para produção; para desenvolvimento local pode usar modo de teste temporariamente).

3. Adicionar regras no Realtime Database

- No painel do Realtime Database vá até a aba "Rules".
- Substitua o conteúdo pelas regras abaixo (exige autenticação para leitura e escrita):

```json
{
  "rules": {
    ".read": "auth != null && auth.token.status == 'Ativo'",
    ".write": "auth != null && auth.token.status == 'Ativo'"
  }
}
```

- Clique em "Publish" para aplicar.

Observação: essas regras simples exigem que o cliente esteja autenticado. Para regras mais granulares (por exemplo por caminho, por papel/uid), expanda conforme necessidade.

4. Ativar Authentication (Email/Senha)

- No painel do Firebase, vá em "Authentication" → "Método de login" (Sign-in method).
- Habilite o provedor "Email/Password".
- Opcional: configurar templates de e-mail, verificação de e-mail, etc.

5. Obter as credenciais do app e colocar nos `environments`

- No painel do projeto vá em "Configurações do projeto" (ícone de engrenagem) → "Configurações do app".
- Registre um novo app (web) se ainda não tiver: clique em "</>" (Web) e siga as instruções.
- Copie as credenciais/Config Firebase (objeto com apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId).

Exemplo (não utilize chaves reais em commits públicos):

```ts
// src/environments/environment.ts
export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIza...',
    authDomain: 'seu-projeto.firebaseapp.com',
    databaseURL: 'https://seu-projeto-default-rtdb.firebaseio.com',
    projectId: 'seu-projeto',
    storageBucket: 'seu-projeto.appspot.com',
    messagingSenderId: '1234567890',
    appId: '1:1234567890:web:abcdef123456',
  },
};
```

- Cole o objeto `firebase` em `src/environments/environment.ts` (e em `environment.prod.ts` com valores apropriados para produção).
