# Criação Automatizada de Projetos Firebase

Guia operacional da área **Criar Projeto** do painel, que cria o projeto Firebase de um tenant novo do começo ao fim: projeto no Google Cloud, Authentication, Realtime Database, app Web, conta de serviço, dados iniciais e o registro no `fitmanager-util`.

Substitui o processo manual descrito em [Configuração e Regras do Firebase](FIREBASE_REGRAS_E_CONFIG.md), que continua válido como referência do que acontece por baixo.

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Configuração Inicial (uma vez só)](#-configuração-inicial-uma-vez-só)
- [Fase 0 — Spike de Validação](#-fase-0--spike-de-validação)
- [Uso no Dia a Dia](#-uso-no-dia-a-dia)
- [As 8 Etapas](#-as-8-etapas)
- [Segurança e Riscos](#-segurança-e-riscos)
- [Manutenção da Conexão](#-manutenção-da-conexão)
- [Troubleshooting](#-troubleshooting)
- [Referência de Comandos](#-referência-de-comandos)

---

## 🎯 Visão Geral

Antes, provisionar um tenant era ~15 passos manuais no console do Firebase, terminando com a colagem de um JSON em **Configuração de Tenants** e o preenchimento de 8 campos em **Configuração de Environments**. Agora é um formulário.

### Por que existe uma conexão OAuth com o Google

O Google não permite que uma _service account_ crie projetos fora de uma Organização do Cloud:

> service accounts are not allowed to create projects outside of an organization resource

Como não há Organização, o painel precisa agir **em nome de uma conta Google real**. Você autoriza uma vez pela tela, e o painel guarda um _refresh token_ cifrado (AES-256-GCM, a mesma chave `TENANT_SA_ENC_KEY` das chaves privadas dos tenants) em `clientes/googleOAuth/provisionador`.

### Onde o resultado é gravado

| Nó (no `fitmanager-util`)                        | Conteúdo                               |
| ------------------------------------------------ | -------------------------------------- |
| `clientes/serviceAccounts/{tenant}`              | Chave privada cifrada do projeto novo  |
| `clientes/firebaseConfigs/{tenant}`              | Config web (`apiKey`, `authDomain`, …) |
| `clientes/firebaseConfigsDesabilitados/{tenant}` | Mesma config, de tenants desabilitados |
| `clientes/tenantByProjectId/{projectId}`         | Índice reverso                         |
| `clientes/provisionamentos/{tenant}`             | Histórico da criação (auditoria)       |

---

## ⚙️ Configuração Inicial (uma vez só)

> 💡 A [Fase 0](#-fase-0--spike-de-validação) **não depende de nada desta seção** — o spike usa o OAuth embutido do `gcloud`, não o OAuth Client do painel. Se quiser, rode o spike primeiro e só monte o OAuth Client depois de confirmar que a automação é viável.

### 1. Criar o OAuth Client

> ⚠️ **Isto é no console do Google Cloud, não no do Firebase.** São dois sites sobre o mesmo projeto, e esta parte só existe no do Cloud (`console.cloud.google.com`). Se você estiver vendo "Visão geral do projeto", "Realtime Database" e "Authentication" no menu lateral, está no Firebase — troque de site.
>
> O Google reorganizou essa área: o antigo **APIs e Serviços → Tela de consentimento OAuth** virou **Google Auth Platform**, dividido em Branding, Público-alvo (Audience) e Clientes (Clients).

Os três links abaixo já abrem no projeto certo:

**1.1 — Branding** · [console.cloud.google.com/auth/branding?project=fitmanager-util](https://console.cloud.google.com/auth/branding?project=fitmanager-util)

Se aparecer "Google Auth Platform ainda não configurado", clique em **Começar** e preencha o assistente de 4 passos:

- Nome do app: algo reconhecível, ex.: `Painel Fitware`
- E-mail de suporte: o seu
- Público-alvo: **Externo**
- Dados de contato: o seu e-mail

Depois, ainda em Branding, em **Domínios autorizados**, adicione o domínio raiz:

```
adftecnologia.com.br
```

> O Google exige que o domínio das URIs de redirecionamento esteja nesta lista. Se ele pedir comprovação de propriedade, é uma etapa única no [Google Search Console](https://search.google.com/search-console) — registro TXT no DNS ou arquivo HTML no site —, feita com a **mesma conta Google** que está configurando aqui.

**1.2 — Público-alvo** · [console.cloud.google.com/auth/audience?project=fitmanager-util](https://console.cloud.google.com/auth/audience?project=fitmanager-util)

Em **Status da publicação**, clique em **Publicar app** para sair de "Testes" e ir para **Em produção**. Este passo não é opcional — veja o aviso abaixo.

**1.3 — Clientes** · [console.cloud.google.com/auth/clients?project=fitmanager-util](https://console.cloud.google.com/auth/clients?project=fitmanager-util)

**Criar cliente** → tipo **Aplicativo da Web** → em **URIs de redirecionamento autorizados**, adicione as duas:

```
https://painel-fitware.adftecnologia.com.br/api/routes/google-oauth-callback
http://localhost:3001/api/routes/google-oauth-callback
```

Ao salvar, o Google mostra o **Client ID** e o **Client secret** — são os dois valores do passo 3.

#### Como a URI é formada

Não existe domínio padrão: o Google compara a URI **caractere por caractere** com a que o painel envia, e o painel envia exatamente o valor de `GOOGLE_OAUTH_REDIRECT_URI`. Se divergir em qualquer detalhe, a tela de consentimento devolve `redirect_uri_mismatch`.

É sempre a **origem do painel** + o caminho fixo da rota de callback — sem `/login` nem qualquer outra rota da tela:

```
https://painel-fitware.adftecnologia.com.br   ← origem (o que vem antes da primeira barra)
/api/routes/google-oauth-callback             ← caminho fixo, definido pelo nome do arquivo da função
```

- **Local:** `http://localhost:3001` (a porta do `vercel dev`). `http://` só é aceito para `localhost`; qualquer outro domínio precisa ser `https://`.
- Um mesmo cliente aceita **várias URIs**, então cadastre as duas de uma vez.
- Barra final conta: `.../google-oauth-callback` e `.../google-oauth-callback/` são URIs diferentes para o Google.

> ⚠️ **Deploys de preview não funcionam com OAuth.** A Vercel gera uma URL nova a cada deploy de preview (`projeto-abc123-time.vercel.app`), e nenhuma delas vai bater com o que está registrado. A conexão com o Google só funciona no **domínio de produção** e em **localhost**. Se precisar conectar a partir de um ambiente de preview, dê a ele um domínio fixo na Vercel e registre esse domínio aqui também.
>
> Como `GOOGLE_OAUTH_REDIRECT_URI` é definida por ambiente na Vercel, cada ambiente pode ter seu valor — e cada valor precisa estar nesta lista.

#### "Publicado" e "verificado" são coisas diferentes

O Google usa nomes parecidos para dois processos que não têm relação. Confundir os dois leva a achar que algo deu errado quando está tudo certo:

|                          | O que é                                                                | O que fazer                           |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------- |
| **Status de publicação** | "Testes" ou "Em produção". É o que define a expiração do refresh token | **Publique** (passo 1.2). Obrigatório |
| **Verificação do app**   | Revisão manual do Google que remove a tela de aviso                    | **Não faça.** Não é necessário        |

> ⚠️ **O app precisa estar "Em produção".** Em **"Testes"** o Google expira o refresh token **a cada 7 dias**, independentemente de uso — e nenhuma rotina de renovação evita isso, porque a expiração é por data fixa de emissão. Publicado, o token só morre se for revogado ou ficar 6 meses sem uso (é para isso que existe o cron).

**A tela "A Google não validou esta app" vai aparecer sempre, e isso é esperado.** Não é erro, não é falta de propagação, e publicar não faz ela sumir. Ela aparece porque `cloud-platform` é um escopo sensível e o app não passou pela verificação do Google.

Para seguir: clique em **Avançadas** (ou "Ocultar Avançadas", se já estiver aberto) e depois em **"Aceder a &lt;nome do app&gt; (inseguro)"**. O consentimento acontece normalmente e o refresh token é emitido igual.

Pedir a verificação formal só serviria para remover esse aviso — e, com escopo sensível, envolveria uma avaliação de segurança do Google. Para uma ferramenta interna que uma única conta autoriza, não compensa. O limite de 100 usuários de apps publicados sem verificação também é irrelevante aqui. Ignore o item **Central de verificação** no menu lateral.

### 2. Gerar o segredo do cron

```bash
openssl rand -base64 24
```

### 3. Cadastrar as variáveis

No `.env.local` e em **Vercel → Settings → Environment Variables**:

```bash
GOOGLE_OAUTH_CLIENT_ID=XXXXXXXX.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-XXXXXXXXXXXXXXXX
GOOGLE_OAUTH_REDIRECT_URI=https://painel-fitware.adftecnologia.com.br/api/routes/google-oauth-callback
CRON_SECRET=<saída do openssl acima>
```

No `.env.local` (desenvolvimento), duas linhas mudam:

```bash
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/routes/google-oauth-callback
PAINEL_BASE_URL=http://localhost:4200
```

> Em desenvolvimento o painel roda em **duas origens**: a interface em `:4200` (`ng serve`) e as funções em `:3001` (`vercel dev`) — é o que o `environment.local.ts` já pressupõe ao apontar o `baseUrl` para `localhost:3001`.
>
> Por isso as duas variáveis: a de redirecionamento aponta para a **função** (`:3001`), que é quem o Google chama; e `PAINEL_BASE_URL` aponta para a **interface** (`:4200`), que é para onde o usuário volta depois. Em produção as duas coisas dividem o mesmo domínio, então `PAINEL_BASE_URL` pode ficar em branco ou nem existir — o retorno cai na origem da própria URI de redirecionamento.

As demais (`FIREBASE_*`, `CONFIG_FIREBASE_*`, `TENANT_SA_ENC_KEY`) já devem existir — veja [`.env.example`](../.env.example).

---

## 🔬 Fase 0 — Spike de Validação

> ✅ **Já executado. O resultado está abaixo** — não é preciso rodar de novo, a não ser para revalidar depois de alguma mudança do Google.

### Resultado medido

| Pergunta                                                   | Veredito            | Evidência                                                                                                            |
| ---------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Criar o **Realtime Database** (instância default) no Spark | ✅ **Funciona**     | `type: DEFAULT_DATABASE`, `state: ACTIVE`, projeto confirmado sem billing                                            |
| Habilitar o **Authentication** no Spark                    | ❌ **Não funciona** | `identityPlatform:initializeAuth` → `BILLING_NOT_ENABLED : Identity Platform feature requires billing to be enabled` |
| Cadastrar usuário por e-mail/senha sem habilitar nada      | ❌ **Não funciona** | `accounts:signUp` → `CONFIGURATION_NOT_FOUND` — o provider não vem ligado por padrão                                 |

**Conclusão: 7 das 8 etapas são automatizáveis.** A habilitação do Authentication é o único passo que exige um clique no console do Firebase — o painel para nessa etapa, mostra as instruções com link direto, e retoma sozinho depois (ver [Quando o painel pede uma ação sua](#quando-o-painel-pede-uma-ação-sua)).

Um achado de tabela: os erros `PERMISSION_DENIED` em `firebasedatabase.instances.create` e `does not exist` numa service account recém-criada **são consistência eventual do IAM**, não falta de permissão — passam sozinhos quando o projeto assenta. Por isso as chamadas têm retry com backoff.

### Rodar novamente

É um teste descartável. Roda a sequência inteira num projeto novo e imprime o resultado de cada passo.

### Comandos

```bash
# 1. Autoriza sua conta Google (abre o navegador)
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/firebase

# 2. Roda o teste
node scripts/spike-provisionamento.js
```

Opções:

```bash
node scripts/spike-provisionamento.js --projeto=meu-id-custom  # usa um ID específico
node scripts/spike-provisionamento.js --manter                 # omite o lembrete de exclusão
```

> 💡 Com `--projeto=<id-de-um-spike-anterior>` o script **reaproveita** o projeto em vez de falhar. É o jeito de reexecutar só os passos que deram erro sem gastar outra vaga da cota. Os passos 6 e 7 vão reportar "já existe" nesse caso — é esperado.

### O que cada passo faz

| #   | Passo                                            | Onde mexe                           |
| --- | ------------------------------------------------ | ----------------------------------- |
| 0   | Troca o refresh token do ADC por um access token | Nada                                |
| 1   | Cria o projeto `spike-fw-<timestamp>`            | **Projeto novo**                    |
| 1b  | Confirma que o projeto está no Spark             | Nada (só leitura)                   |
| 2   | Habilita 6 APIs                                  | Só no projeto novo                  |
| 3   | Adiciona Firebase                                | Só no projeto novo                  |
| 4   | Cria o Realtime Database                         | Só no projeto novo — **Pergunta 1** |
| 5   | Liga o login e-mail/senha                        | Só no projeto novo — **Pergunta 2** |
| 6   | Cria o app Web e lê a config                     | Só no projeto novo                  |
| 7   | Cria service account, concede IAM e gera a chave | Só no projeto novo                  |

### Posso rodar com outra conta Google?

**Sim, e é recomendável.** O projeto de teste consome uma vaga da cota de quem o criou (padrão ~25 projetos por usuário), então é melhor gastar essa vaga numa conta descartável do que na conta definitiva.

O spike é independente do painel: não lê o `.env`, não toca no `fitmanager-util` e não usa o OAuth Client. Ele só precisa do arquivo de credencial que o `gcloud` grava.

**Mas o resultado só se transfere se a conta de teste for equivalente à definitiva nos dois pontos que determinam a resposta:**

| Condição                                  | Por quê                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sem Organização GCP**                   | Numa conta de Workspace com Organização, projetos novos herdam políticas e podem nascer diferentes                                               |
| **Sem billing vinculado automaticamente** | Se a conta tiver uma billing account que se auto-vincula, o projeto nasce Blaze — e aí as duas perguntas respondem "funciona" pelo motivo errado |

O passo **1b** do spike checa isso sozinho e avisa se o veredito não for confiável. Para conferir à mão:

```bash
gcloud beta billing projects describe spike-fw-XXXXX
# o veredito só vale se billingEnabled: false
```

### Lendo o resultado

```
VEREDITO
  ✅ Criar RTDB (DEFAULT_DATABASE) no Spark → FUNCIONA no Spark
  ✅ Habilitar login e-mail/senha no Spark → FUNCIONA no Spark

Automação 100% viável no Spark. Seguir o plano sem contingência.
```

Se alguma falhar, aquela etapa precisa virar passo manual no console — o resto do fluxo continua automático.

### Limpeza

```bash
gcloud projects delete spike-fw-XXXXX          # o script imprime o ID exato
gcloud auth application-default revoke         # revoga a credencial local
```

> Apagar projeto no Google é reversível por 30 dias.

---

## 🚀 Uso no Dia a Dia

### Conectar a conta Google

Na área **Criar Projeto**, o primeiro card mostra o estado da conexão. Clique em **Conectar conta Google**, escolha a conta, aceite o consentimento, e você volta para a tela já conectado. Isso é feito **uma vez** — não a cada criação.

> ⚠️ **A conta que você conectar aqui vira a dona dos projetos dos tenants.** Ela é quem "cria" cada projeto no Google, e a cota de projetos consumida é a dela. Migrar isso depois é trabalhoso: dá para adicionar outra conta como Owner, mas o projeto continua contando na cota de quem o criou. **Para tenants reais, conecte a conta definitiva já no primeiro.**
>
> Isso é diferente da Fase 0, onde usar uma conta descartável é o certo — lá o projeto é jogado fora no fim.

Para **trocar de conta**: clique em **Desconectar** e depois em **Conectar conta Google** de novo. O Google abre o seletor de contas, sem precisar sair da sua sessão. Os tenants já criados não são afetados — eles já têm a credencial própria guardada no `fitmanager-util`.

### Criar um tenant

Clique em **Novo projeto**, preencha o formulário e confirme em **Criar projeto**. O formulário fecha e a **timeline abre automaticamente**, mostrando as 8 etapas conforme elas acontecem.

Fechar a timeline não cancela nada: a execução continua, e a linha na tabela mostra o andamento. Para voltar a acompanhar, é só clicar em **Timeline** naquela linha.

| Campo                         | Observação                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| **Tenant**                    | Subdomínio do cliente e chave dos nós no `fitmanager-util`. Minúsculas, números e hífen        |
| **ID do projeto**             | Preenchido automaticamente a partir do tenant, editável. **Imutável e único no mundo inteiro** |
| **Nome exibido**              | Como o projeto aparece no console                                                              |
| **Região do RTDB**            | `us-central1`, `europe-west1` ou `asia-southeast1`                                             |
| **Nome da empresa**           | Vai para `whatsAppConfig/nomeEmpresa` no projeto novo                                          |
| **Admin (nome/e-mail/senha)** | Primeiro usuário do tenant. A senha **nunca é gravada** — viaja apenas nas requisições         |

### Quando o painel pede uma ação sua

Na etapa **Habilitar login por e-mail/senha**, o fluxo para com o selo **"Aguardando você"** — isso não é erro, é o único passo que o Google não deixa automatizar no plano Spark.

Dentro da timeline aparece um cartão com as instruções e um link direto para
`console.firebase.google.com/project/{seu-projeto}/authentication/providers`:

1. Abrir o link e clicar em **"Vamos começar"**, se aparecer.
2. Escolher **E-mail/senha** na lista de provedores.
3. Ativar a primeira chave e salvar.
4. Voltar ao painel e clicar em **"Já habilitei — continuar"**.

O botão não confia na sua palavra: ele reexecuta a etapa, que só passa se a configuração existir de fato no Google. Se ainda não estiver pronta, o fluxo continua parado ali. Depois disso as etapas restantes seguem sozinhas.

### Se uma etapa falhar

O estado fica salvo. Abra a **Timeline** daquela linha: a etapa aparece em vermelho com a mensagem do Google, e o botão **Tentar novamente** no rodapé do modal retoma de onde parou. Cada etapa detecta o que já foi criado, então repetir é seguro.

Fechar a página no meio não perde nada — o registro vive no `fitmanager-util`. Ao voltar, abra a timeline da linha e retome.

**A única coisa que não sobrevive é a senha do admin**, porque ela nunca é gravada. Se a criação parou na última etapa (_Semear dados iniciais_), a timeline mostra um campo para digitá-la de novo; nas demais etapas o botão de retomar aparece sozinho.

### Habilitar e desabilitar um tenant

Serve como chave geral do cliente, sem apagar nada.

**Desabilitar** move a configuração de `clientes/firebaseConfigs/{tenant}` para `clientes/firebaseConfigsDesabilitados/{tenant}`, junto com a data e quem fez. O app do cliente lê aquele nó no boot, então **ele sai do ar** — quem acessar vê a tela de ambiente não encontrado.

O que **não** é afetado: o projeto no Google, os dados do tenant, os usuários e a credencial que o painel usa para administrá-lo. A gestão de usuários daquele tenant continua funcionando pelo painel.

**Habilitar** move de volta, idêntico ao que era. É por isso que a config é movida em vez de apagada — reabilitar não depende de reler nada do Google nem de a conexão OAuth estar válida.

O botão está em **Configuração de Environments** (onde alcança todos os tenants, inclusive os cadastrados à mão) e também na tabela de **Criar Projeto**. Os dois pedem confirmação, e o estado desejado vai explícito na requisição: se a tela estiver desatualizada, o backend recusa dizendo que o tenant já está naquele estado, em vez de alternar para o lado errado.

Tenants desabilitados continuam aparecendo na lista de Environments, com selo próprio — do contrário sumiriam da tela e não haveria caminho para reabilitar. A edição da config fica bloqueada enquanto estiver desabilitado.

### Histórico e busca

A tabela lista **todos** os provisionamentos, inclusive os concluídos — o registro nunca é apagado sozinho, serve como auditoria. A busca no topo filtra por tenant, ID do projeto, nome exibido ou empresa.

**Timeline** abre o modal com todas as etapas: data, duração e resumo de cada uma, incluindo as tentativas que falharam e foram refeitas. É a mesma tela usada para acompanhar uma criação ao vivo e para retomar uma parada.

**Descartar** remove apenas esse registro de histórico. O projeto no Google, o tenant e o environment **continuam existindo**.

---

## 📝 As 8 Etapas

| #   | Etapa                    | API                                  | O que faz                                                                                                                          |
| --- | ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Criar projeto            | `cloudresourcemanager/v1/projects`   | Cria o projeto e guarda o `projectNumber`                                                                                          |
| 2   | Habilitar APIs           | `serviceusage…/services:batchEnable` | Firebase, RTDB, Identity Toolkit, IAM, Service Usage, Resource Manager                                                             |
| 3   | Adicionar Firebase       | `firebase…:addFirebase`              | Transforma o projeto GCP em projeto Firebase                                                                                       |
| 4   | Criar RTDB               | `firebasedatabase…/instances`        | Instância `DEFAULT_DATABASE`. **Lê a URL real devolvida** — instâncias regionais usam `firebasedatabase.app`, não `firebaseio.com` |
| 5   | Habilitar Auth ⚠️        | `identitytoolkit/admin/v2/…/config`  | `PATCH` com `updateMask=signIn.email`. **Único passo com ação manual no Spark** — a config não existe e só o console a cria        |
| 6   | App Web + environment    | `firebase…/webApps`                  | Cria o app, lê a config e grava `clientes/firebaseConfigs/{tenant}`                                                                |
| 7   | Service account + tenant | `iam…/serviceAccounts`               | Cria a conta, concede `roles/firebase.sdkAdminServiceAgent`, emite a chave e grava `clientes/serviceAccounts/{tenant}` cifrada     |
| 8   | Seed + admin             | Admin SDK                            | Cria o admin no Auth e semeia os nós de configuração                                                                               |

### Uma requisição por etapa

O painel **não** manda tudo de uma vez. Um `POST` inicia o provisionamento e, a partir daí, cada etapa é um `PATCH` separado para a mesma função. Isso dá quatro coisas:

- **Nenhuma invocação chega perto do `maxDuration` de 60s** — a sequência inteira leva 1 a 3 minutos, o que jamais caberia numa só.
- **Um log por etapa na Vercel**, em vez de um bloco único difícil de depurar.
- **Retomada de verdade:** o estado vive no Realtime Database entre uma etapa e outra, então fechar a aba não perde nada.
- **Tempo para o Google propagar**, que é o ponto seguinte.

### Propagação: a espera mora entre as requisições

Recursos recém-criados no Google levam segundos para ficar visíveis para a chamada seguinte. Medido na Fase 0: `firebasedatabase.instances.create` devolve `PERMISSION_DENIED` e uma service account criada há instantes responde `does not exist` — os dois passam sozinhos depois.

Tratar isso dormindo dentro da função seria o caminho errado: o orçamento de backoff competiria com o `maxDuration` e um passo lento viraria `504`, sem nada gravado no histórico. Então o desenho é o inverso:

| Onde                                 | Quanto                     | Para quê                                                                                                                                     |
| ------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Dentro de uma invocação (`comRetry`) | 3 tentativas, ~9s          | Propagação rápida, resolvida sem voltar ao frontend                                                                                          |
| Entre invocações                     | até 8 tentativas, ~6s cada | Propagação lenta. O backend devolve `aguardandoPropagacao`, mantém o status em andamento, e o frontend espera antes de repetir a mesma etapa |

A tela mostra "Aguardando o Google liberar o recurso recém-criado" enquanto isso, para a timeline parada não parecer travada. Se a etapa passar depois de esperar, o resumo no histórico registra em quantas tentativas.

### Por que as gravações estão nas etapas 6 e 7, e não numa etapa final

A etapa 8 usa `getTenantContext(tenant)`, que lê a credencial recém-gravada e a decifra. Assim **a chave privada nunca precisa trafegar entre invocações** nem ser guardada em texto claro.

### O que é semeado

```json
{
  "tenantConfig": {
    "gatewayConfig": {
      "ativo": false,
      "gateway": "",
      "habilitarPixMP": false,
      "realizadoOAuth": false
    }
  },
  "nomenclaturaConfig": { "tipoPainel": "Alunos" },
  "whatsAppConfig": {
    "chavePix": "",
    "gestor": { "nome": "", "whatsapp": "" },
    "gupShup": false,
    "nomeEmpresa": "<do formulário>"
  },
  "dados-usuario": {
    "<uid>": {
      "uid": "…",
      "name": "…",
      "email": "…",
      "role": "Admin",
      "status": "Ativo",
      "permissions": [],
      "phoneNumber": "",
      "createdAt": "…",
      "updatedAt": "…"
    }
  }
}
```

Coleções de negócio (`alunos`, `contasReceber`, `categorias`, …) **não** são semeadas: o Realtime Database descarta objetos vazios e todo caminho de leitura do app já tolera nó ausente.

> Os usuários do tenant ficam em **`dados-usuario/{uid}`**, não em `usuarios`.

---

## 🔒 Segurança e Riscos

### O painel nunca apaga projeto no Google

Não existe nenhuma chamada `DELETE` contra as APIs do Google, nem no fluxo do painel nem no script do spike. Para apagar um projeto, use o console ou `gcloud projects delete`.

### Salvaguardas contra mexer em coisa existente

| Salvaguarda                                 | O que impede                                                                                                                                                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assertTenantLivre()`                       | Recusa iniciar se o tenant já está cadastrado em Configuração de Tenants ou Environments. Sem isso, digitar o nome de um cliente existente reescreveria os nós dele apontando para um projeto vazio — **o cliente sairia do ar**  |
| `projectNumberEsperado` em `criarProjeto()` | Só reaproveita um projeto existente se foi _este mesmo provisionamento_ que o criou. Um `projectId` que colide com outro projeto para o fluxo com erro, em vez de alterá-lo                                                       |
| `semearSeAusente()`                         | O seed só grava nó que **não existe**. Num projeto novo o efeito é idêntico a um update direto; num banco com dados, preserva `whatsAppConfig` (chave PIX, nome da empresa) e `tenantConfig/gatewayConfig` (conexão Mercado Pago) |
| `setIamPolicy` com `etag`                   | A concessão de papel **acrescenta** um binding preservando os existentes                                                                                                                                                          |

### Risco por etapa

| Etapa | Pode apagar ou quebrar algo existente?                          |
| ----- | --------------------------------------------------------------- |
| 1 a 5 | Não — escopo é o projeto novo                                   |
| 6 e 7 | Não — `assertTenantLivre` bloqueia antes se o tenant já existir |
| 8     | Não — só grava nó ausente                                       |

### O risco que permanece, e é inerente

O escopo `cloud-platform` dá à conexão OAuth **poder total sobre todos os projetos da conta**. O código usa cerca de uma dúzia de endpoints, nenhum destrutivo — mas a autorização em si é ampla, porque o Google não oferece escopo restrito o bastante para "criar projetos e configurar só os que eu criei".

Mitigações:

- Use uma **conta Google dedicada** ao provisionamento, não a conta principal.
- Revogue quando não estiver usando: [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- O arquivo local do ADC (`~/.config/gcloud/application_default_credentials.json`) carrega o mesmo poder. Após o spike: `gcloud auth application-default revoke`.

### Cota de projetos

Projetos criados fora de uma Organização consomem a cota da conta de usuário (padrão ~25 criados). Ao estourar, a API devolve erro — **nada é apagado para abrir espaço**. O aumento se pede no console do Google.

### Cloud Storage no plano Spark

O bucket padrão exige Blaze desde outubro/2024, então `storageBucket` volta vazio da API. O painel grava o nome convencional `{projectId}.firebasestorage.app`; o bucket passa a existir se o projeto for atualizado para Blaze.

---

## 🔄 Manutenção da Conexão

Um cron diário (`0 4 * * *`) chama `/api/routes/cron-oauth-keepalive` e renova o token.

**Por que existe:** o Google expira refresh tokens que passam **6 meses sem uso**, e só a chamada ao endpoint de token (`grant_type=refresh_token`) reseta esse contador — usar o access token nas APIs **não conta**.

**O ganho no dia a dia:** se a autorização for revogada, o cron detecta no dia seguinte, marca a conexão como `EXPIRADA`, e o aviso aparece no **Dashboard** e na tela **Criar Projeto** com o botão de reconectar. Você descobre antes de precisar.

> ⚠️ Isto **não** substitui publicar a tela de consentimento. Em modo "Testing" a expiração é por data de emissão, e nenhuma renovação evita.

No plano Hobby da Vercel o cron roda **1×/dia** com precisão de ±59 min — expressões mais frequentes falham no deploy.

### Testar o cron sem esperar o agendamento

`vercel dev` não executa crons. Chame a rota direto:

```bash
# Deve responder 200 e gravar ultimaRenovacao
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3001/api/routes/cron-oauth-keepalive

# Sem o header deve responder 401
curl -i http://localhost:3001/api/routes/cron-oauth-keepalive
```

---

## 🔧 Troubleshooting

### Primeiro passo: rodar o diagnóstico

```bash
npm run validar:config
```

Valida de baixo para cima tudo de que a área depende — variáveis, chave de criptografia, coerência das URLs, acesso aos dois projetos Firebase e a conexão OAuth — e, para cada falha, diz o que fazer. É somente leitura e não imprime nenhum segredo.

Se ele terminar com "Configuração completa", o problema não está no ambiente: siga para a tabela abaixo ou olhe o log da função na Vercel (ou no terminal do `vercel dev`), que registra cada etapa com o nome do tenant.

| Mensagem                                                                            | Causa                                                      | O que fazer                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `O tenant "x" já está cadastrado em …`                                              | O tenant existe em Configuração de Tenants ou Environments | Use outro nome, ou remova o cadastro antes                                                                                                                               |
| `O projeto "x" já existe no Google Cloud e não foi criado por este provisionamento` | Colisão de `projectId` (global, no mundo inteiro)          | Escolha outro ID no formulário                                                                                                                                           |
| Tela "A Google não validou esta app"                                                | Esperado — o app não passou pela verificação do Google     | **Não é erro e não some publicando.** Clique em **Avançadas → "Aceder a … (inseguro)"**. Ver ["Publicado" e "verificado"](#publicado-e-verificado-são-coisas-diferentes) |
| `redirect_uri_mismatch` na tela do Google                                           | A URI enviada não está registrada, ou difere num detalhe   | Compare `GOOGLE_OAUTH_REDIRECT_URI` com a lista em Clientes — inclusive barra final e `http`/`https`. Em preview da Vercel é esperado: use produção ou localhost         |
| `A autorização do Google expirou ou foi revogada`                                   | Refresh token inválido                                     | Clique em **Reconectar conta Google**. Se repetir a cada 7 dias, a tela de consentimento está em "Testing"                                                               |
| `O Google não devolveu um refresh token`                                            | A conta já tinha autorizado antes                          | Revogue em [myaccount.google.com/permissions](https://myaccount.google.com/permissions) e conecte de novo                                                                |
| `SERVICE_DISABLED` / `has not been used`                                            | APIs ainda propagando no projeto novo                      | Já há retry com backoff. Se persistir, **Tentar novamente**                                                                                                              |
| `requires a quota project, which is not set by default`                             | Chamada de API sem o header `x-goog-user-project`          | As chamadas de RTDB e Identity Toolkit já enviam o header. Se aparecer em outra API, ela também precisa dele                                                             |
| `CONFIGURATION_NOT_FOUND` ou `BILLING_NOT_ENABLED` na etapa 5                       | Esperado no Spark — não é falha                            | A etapa vira "Aguardando você". Siga as instruções do cartão e clique em "Já habilitei — continuar"                                                                      |
| `Permission ... denied` ou `does not exist` logo após criar o projeto               | Consistência eventual do IAM                               | Já há retry com backoff. Se persistir, aguarde um minuto e use **Tentar novamente**                                                                                      |
| `field [display_name] has issue [...at most 30 characters]`                         | Nome exibido fora da faixa de 4 a 30 caracteres            | Encurte o **Nome exibido no console**. O formulário já barra antes de enviar                                                                                             |
| `quota` / `limit` na etapa 1                                                        | Cota de projetos esgotada                                  | Peça aumento no console do Google                                                                                                                                        |
| `A operação do Google não concluiu a tempo`                                         | LRO passou do timeout da etapa                             | **Tentar novamente** — a etapa detecta o que já foi criado                                                                                                               |
| `CONFIGURATION_NOT_FOUND` na etapa 5                                                | Identity Toolkit sem config inicializada                   | Habilite o Authentication uma vez no console e retome                                                                                                                    |
| `Informe a senha do administrador do tenant`                                        | Página recarregada no meio do fluxo                        | Redigite a senha no formulário e retome                                                                                                                                  |

---

## 📚 Referência de Comandos

```bash
# --- Fase 0 (uma vez, antes do primeiro uso) ---
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/firebase
node scripts/spike-provisionamento.js
gcloud projects delete spike-fw-XXXXX
gcloud auth application-default revoke

# --- Segredo do cron ---
openssl rand -base64 24

# --- Diagnóstico (rode primeiro quando algo não funcionar) ---
npm run validar:config     # checa env, cripto, acesso aos Firebase e conexão OAuth

# --- Desenvolvimento ---
npm run start:dev          # Angular (4200) + funções Vercel (3001)
npm run type-check         # tsconfig da app e da API
npm run format:check       # Prettier
npm run build:dev          # build Angular

# --- Testar o cron localmente ---
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3001/api/routes/cron-oauth-keepalive

# --- Contar funções serverless (limite de 12 no plano free) ---
find api -name '*.ts' -not -name 'tsconfig*' | wc -l
```

### Arquivos da feature

| Arquivo                                | Papel                                               |
| -------------------------------------- | --------------------------------------------------- |
| `lib/helper/google-oauth.helper.ts`    | Conexão OAuth, cifra do refresh token, access token |
| `lib/helper/google-cloud.helper.ts`    | Cliente das APIs REST do Google                     |
| `lib/helper/provisionamento.helper.ts` | Máquina de estados das 8 etapas                     |
| `api/routes/dev-config.ts`             | Recursos `google-oauth` e `project-provision`       |
| `api/routes/google-oauth-callback.ts`  | Retorno do consentimento                            |
| `api/routes/cron-oauth-keepalive.ts`   | Cron diário                                         |
| `src/app/components/criar-projeto/`    | A tela                                              |
| `src/app/shared/components/timeline/`  | Timeline reaproveitável                             |
| `scripts/spike-provisionamento.js`     | Teste da Fase 0 (descartável)                       |
