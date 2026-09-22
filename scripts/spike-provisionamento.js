#!/usr/bin/env node
/**
 * Fase 0 — Spike de validação do provisionamento automatizado.
 *
 * Script DESCARTÁVEL. Existe para responder duas perguntas que a documentação
 * do Google não responde de forma conclusiva:
 *
 *   1) Criar a instância DEFAULT do Realtime Database funciona no plano Spark?
 *      (a doc do endpoint diz "Only available for projects on the Blaze plan",
 *      mas o provider Terraform qualifica isso como válido só para *user*
 *      databases, e expõe DEFAULT_DATABASE como tipo aceito)
 *
 *   2) Habilitar o provider e-mail/senha via PATCH em
 *      identitytoolkit/admin/v2/projects/{id}/config funciona no Spark?
 *      (o método initializeAuth exige billing, mas ele serve para o upgrade
 *      para Identity Platform — que não precisamos)
 *
 * O script cria UM projeto de teste real na sua conta Google e executa a
 * sequência inteira, imprimindo o resultado de cada passo. Nada é gravado no
 * fitmanager-util.
 *
 * ---------------------------------------------------------------------------
 * COMO RODAR
 *
 *   1. Autentique-se uma vez (abre o navegador):
 *
 *        gcloud auth application-default login \
 *          --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/firebase
 *
 *   2. Rode o script:
 *
 *        node scripts/spike-provisionamento.js
 *
 *   3. Ao final, APAGUE o projeto de teste em
 *      https://console.cloud.google.com/cloud-resource-manager
 *      (o script imprime o ID exato no resumo)
 *
 * Opções:
 *   --projeto=<id>   usa/continua um projectId específico em vez de gerar um
 *   --manter         não imprime o lembrete de exclusão
 * ---------------------------------------------------------------------------
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/// CONSTANTES ///

const LOCATION_RTDB = 'us-central1';

const APIS_NECESSARIAS = [
  'firebase.googleapis.com',
  'firebasedatabase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'iam.googleapis.com',
  'serviceusage.googleapis.com',
  'cloudresourcemanager.googleapis.com',
];

/** Passos cujo resultado é a razão de existir deste spike. */
const PERGUNTAS = {
  RTDB: 'Criar RTDB (DEFAULT_DATABASE) no Spark',
  AUTH: 'Habilitar login e-mail/senha no Spark',
  AUTH_REAL: 'Cadastrar usuário por e-mail/senha (o que importa na prática)',
};

/// SAÍDA ///

const cores = {
  reset: '\x1b[0m',
  cinza: '\x1b[90m',
  verde: '\x1b[32m',
  vermelho: '\x1b[31m',
  amarelo: '\x1b[33m',
  azul: '\x1b[36m',
  negrito: '\x1b[1m',
};

const log = {
  titulo: msg =>
    console.log(`\n${cores.negrito}${cores.azul}${msg}${cores.reset}`),
  passo: msg => console.log(`${cores.cinza}  ···${cores.reset} ${msg}`),
  ok: msg => console.log(`${cores.verde}  ✅${cores.reset} ${msg}`),
  erro: msg => console.log(`${cores.vermelho}  ❌${cores.reset} ${msg}`),
  aviso: msg => console.log(`${cores.amarelo}  ⚠️ ${cores.reset} ${msg}`),
  info: msg => console.log(`${cores.cinza}     ${msg}${cores.reset}`),
};

/// CREDENCIAL ///

/**
 * Lê o refresh token do Application Default Credentials do gcloud. É o caminho
 * de menor atrito para um spike: evita ter que criar um OAuth Client e publicar
 * uma tela de consentimento só para responder duas perguntas.
 */
function lerCredencialAdc() {
  const caminho =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(
      os.homedir(),
      '.config',
      'gcloud',
      'application_default_credentials.json'
    );

  if (!fs.existsSync(caminho)) {
    throw new Error(
      `Credencial não encontrada em ${caminho}.\n` +
        '     Rode primeiro:\n' +
        '       gcloud auth application-default login \\\n' +
        '         --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/firebase'
    );
  }

  const credencial = JSON.parse(fs.readFileSync(caminho, 'utf8'));

  if (credencial.type !== 'authorized_user') {
    throw new Error(
      `A credencial em ${caminho} é do tipo "${credencial.type}".\n` +
        '     O spike precisa de uma credencial de USUÁRIO ("authorized_user"), porque\n' +
        '     service accounts não podem criar projetos fora de uma Organização.'
    );
  }

  return credencial;
}

async function obterAccessToken({ client_id, client_secret, refresh_token }) {
  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const corpo = await resposta.json();

  if (!resposta.ok) {
    throw new Error(
      `Falha ao trocar o refresh token (${resposta.status}): ${corpo.error_description || corpo.error}`
    );
  }

  return corpo.access_token;
}

/// HTTP ///

let accessToken = '';

/**
 * @param quotaProjectId Projeto ao qual atribuir a cota da chamada.
 *
 * Algumas APIs (firebasedatabase e identitytoolkit, entre outras) recusam
 * credenciais de usuário sem um "quota project" definido, com a mensagem
 * "requires a quota project, which is not set by default". O header
 * x-goog-user-project resolve isso por chamada, sem depender de
 * `gcloud auth application-default set-quota-project` — que fixaria um projeto
 * só, enquanto aqui o projeto é criado dinamicamente.
 */
async function chamar(metodo, url, corpo, quotaProjectId) {
  const resposta = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(quotaProjectId ? { 'x-goog-user-project': quotaProjectId } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });

  const texto = await resposta.text();
  let dados = null;

  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = { raw: texto };
  }

  if (!resposta.ok) {
    const detalhe =
      dados?.error?.message || dados?.raw || `HTTP ${resposta.status}`;
    const erro = new Error(detalhe);
    erro.status = resposta.status;
    erro.dados = dados;
    throw erro;
  }

  return dados;
}

const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Faz poll de uma Long Running Operation até done: true. */
async function aguardarOperacao(
  url,
  { timeoutMs = 180000, intervaloMs = 3000 }
) {
  const limite = Date.now() + timeoutMs;

  while (Date.now() < limite) {
    const operacao = await chamar('GET', url);

    if (operacao.done) {
      if (operacao.error) {
        throw new Error(
          `Operação falhou: ${operacao.error.message} (code ${operacao.error.code})`
        );
      }
      return operacao.response || {};
    }

    await dormir(intervaloMs);
  }

  throw new Error(`Operação não concluiu em ${timeoutMs / 1000}s: ${url}`);
}

/**
 * Repete uma chamada enquanto o erro for de propagação de API recém-habilitada.
 * O batchEnable retorna done antes de a API estar realmente disponível em todas
 * as bordas, então a primeira chamada seguinte costuma falhar com SERVICE_DISABLED.
 */
/**
 * Assinaturas de erro que, logo após a criação de um projeto, quase sempre
 * significam "ainda não propagou" e não "não pode":
 *
 *  - SERVICE_DISABLED: a API foi habilitada, mas ainda não em todas as bordas;
 *  - PERMISSION_DENIED: o binding de Owner do projeto novo ainda não valeu;
 *  - "does not exist": recurso recém-criado ainda não visível para a próxima
 *    chamada (é o caso clássico de criar uma service account e usá-la em
 *    seguida no setIamPolicy).
 *
 * O IAM do Google é eventualmente consistente, e este script executa tudo em
 * sequência em poucos segundos — bem dentro da janela de inconsistência.
 */
function ehErroDePropagacao(erro) {
  const mensagem = erro.message ?? '';

  return (
    (erro.status === 403 &&
      /SERVICE_DISABLED|has not been used|is disabled|Permission .* denied/i.test(
        mensagem
      )) ||
    ([400, 403, 404].includes(erro.status) &&
      /does not exist|may not exist/i.test(mensagem))
  );
}

async function comRetry(fn, { tentativas = 6, backoffMs = 5000 } = {}) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;

      if (!ehErroDePropagacao(erro) || tentativa === tentativas) {
        throw erro;
      }

      log.info(
        `pode ser propagação, aguardando… (tentativa ${tentativa}/${tentativas})`
      );
      await dormir(backoffMs * tentativa);
    }
  }

  throw ultimoErro;
}

/// PASSOS ///

function gerarProjectId() {
  // Regras do GCP: 6–30 chars, começa com letra, minúsculas/dígitos/hífen,
  // não termina com hífen.
  const sufixo = Date.now().toString(36);
  return `spike-fw-${sufixo}`;
}

async function criarProjeto(projectId) {
  const operacao = await chamar(
    'POST',
    'https://cloudresourcemanager.googleapis.com/v1/projects',
    // O nome exibido do projeto aceita de 4 a 30 caracteres. Um prefixo
    // somado ao projectId (até 30) estoura esse limite, então usamos o
    // próprio ID como nome.
    { projectId, name: projectId }
  );

  const resultado = await aguardarOperacao(
    `https://cloudresourcemanager.googleapis.com/v1/${operacao.name}`,
    { timeoutMs: 180000 }
  );

  return resultado.projectNumber || null;
}

/**
 * Diz se o projeto está no Spark (sem billing vinculado).
 *
 * Devolve null quando não dá para saber — a Cloud Billing API pode não estar
 * habilitada na conta, e isso não é motivo para abortar o spike; só torna o
 * veredito não confirmado.
 */
async function estaNoSpark(projectId) {
  try {
    const info = await chamar(
      'GET',
      `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`
    );

    return !info.billingEnabled;
  } catch {
    return null;
  }
}

async function habilitarApis(projectId) {
  const operacao = await chamar(
    'POST',
    `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`,
    { serviceIds: APIS_NECESSARIAS }
  );

  await aguardarOperacao(
    `https://serviceusage.googleapis.com/v1/${operacao.name}`,
    { timeoutMs: 300000 }
  );
}

/** Reconhece o erro de recurso que já existe, em qualquer das redações do Google. */
const ehJaExiste = erro =>
  /already exists|ALREADY_EXISTS|Requested entity already exists/i.test(
    erro.message ?? ''
  );

async function adicionarFirebase(projectId) {
  let operacao;

  try {
    operacao = await comRetry(() =>
      chamar(
        'POST',
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
        {}
      )
    );
  } catch (erro) {
    // Reexecução sobre um projeto que já tem Firebase. Nada a fazer.
    if (ehJaExiste(erro)) {
      return null;
    }
    throw erro;
  }

  return aguardarOperacao(
    `https://firebase.googleapis.com/v1beta1/${operacao.name}`,
    { timeoutMs: 300000 }
  );
}

/** PERGUNTA 1 do spike. */
async function criarRtdb(projectId) {
  const databaseId = `${projectId}-default-rtdb`;
  const url =
    `https://firebasedatabase.googleapis.com/v1beta/projects/${projectId}` +
    `/locations/${LOCATION_RTDB}/instances?databaseId=${databaseId}`;

  const instancia = await comRetry(() =>
    chamar('POST', url, { type: 'DEFAULT_DATABASE' }, projectId)
  );

  return instancia;
}

/**
 * PERGUNTA 2 do spike.
 *
 * O PATCH sozinho falha com CONFIGURATION_NOT_FOUND em projeto novo: habilitar
 * a API pelo Service Usage não cria a configuração do Identity Toolkit. Aqui
 * tentamos, nesta ordem:
 *
 *   1. PATCH direto (funciona se a config já existir);
 *   2. initializeAuth — a doc diz que é "the publicly available variant of
 *      identityPlatform.enable that is only available to billing-enabled
 *      projects", frase ambígua sobre a qual dos dois exige billing. Uma
 *      chamada resolve a dúvida;
 *   3. PATCH de novo, agora que a config deve existir.
 */
async function habilitarLoginEmailSenha(projectId) {
  const urlConfig =
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}` +
    `/config?updateMask=signIn.email`;

  const corpo = {
    signIn: { email: { enabled: true, passwordRequired: true } },
  };

  const patch = () =>
    comRetry(() => chamar('PATCH', urlConfig, corpo, projectId));

  try {
    return await patch();
  } catch (erro) {
    if (!/CONFIGURATION_NOT_FOUND/i.test(erro.message)) {
      throw erro;
    }

    log.info('config ausente — tentando identityPlatform:initializeAuth…');

    await chamar(
      'POST',
      `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`,
      {},
      projectId
    );

    log.info('initializeAuth aceito — repetindo o PATCH');

    return patch();
  }
}

/**
 * Sonda que responde a pergunta que realmente importa para o produto: dá para
 * criar um usuário com e-mail/senha neste projeto?
 *
 * Usa o endpoint client-side com a apiKey do app Web, exatamente como o app do
 * tenant faria. Vale mesmo que o passo 5 tenha falhado: é possível que o
 * provider já venha ligado por padrão e que a configuração seja criada de
 * forma preguiçosa no primeiro cadastro — nesse caso o passo 5 seria
 * dispensável.
 */
async function testarCadastroEmailSenha(apiKey) {
  const resposta = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `spike-${Date.now()}@exemplo.com`,
        password: 'SenhaDeTeste123',
        returnSecureToken: true,
      }),
    }
  );

  const dados = await resposta.json();

  if (resposta.ok) {
    return { ok: true, uid: dados.localId };
  }

  return {
    ok: false,
    motivo: dados?.error?.message ?? `HTTP ${resposta.status}`,
  };
}

async function criarAppWeb(projectId) {
  // Numa reexecução, reaproveitar o app já criado evita encher o projeto de
  // apps Web duplicados a cada rodada.
  const existentes = await chamar(
    'GET',
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`
  );

  let appId = existentes?.apps?.[0]?.appId;

  if (appId) {
    log.info(`app Web já existente reaproveitado (${appId})`);
  } else {
    const operacao = await comRetry(() =>
      chamar(
        'POST',
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
        { displayName: 'Spike Web' }
      )
    );

    const app = await aguardarOperacao(
      `https://firebase.googleapis.com/v1beta1/${operacao.name}`,
      { timeoutMs: 180000 }
    );

    appId = app.appId;
  }

  const config = await chamar(
    'GET',
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${appId}/config`
  );

  return { appId, config };
}

async function criarServiceAccount(projectId) {
  const accountId = 'painel-fitware';
  const email = `${accountId}@${projectId}.iam.gserviceaccount.com`;

  let sa;

  try {
    sa = await comRetry(() =>
      chamar(
        'POST',
        `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`,
        {
          accountId,
          serviceAccount: { displayName: 'Painel Fitware (provisionado)' },
        }
      )
    );
  } catch (erro) {
    if (!ehJaExiste(erro)) {
      throw erro;
    }

    // Reexecução: a conta já existe, seguimos para o papel e a chave.
    log.info('service account já existente reaproveitada');
    sa = { email };
  }

  // Concede o papel que o próprio console do Firebase usa na SA firebase-adminsdk-*.
  const politica = await chamar(
    'POST',
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
    {}
  );

  const papel = 'roles/firebase.sdkAdminServiceAgent';
  const membro = `serviceAccount:${sa.email}`;

  politica.bindings = politica.bindings || [];

  const binding = politica.bindings.find(item => item.role === papel);

  // Numa reexecução o binding já está lá; regravar a política sem necessidade
  // só criaria risco de conflito de etag.
  if (!binding?.members?.includes(membro)) {
    if (binding) {
      binding.members = [...(binding.members ?? []), membro];
    } else {
      politica.bindings.push({ role: papel, members: [membro] });
    }

    await chamar(
      'POST',
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`,
      { policy: politica }
    );
  }

  const chave = await chamar(
    'POST',
    `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${sa.email}/keys`,
    { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE' }
  );

  const json = JSON.parse(
    Buffer.from(chave.privateKeyData, 'base64').toString('utf8')
  );

  return { email: sa.email, json };
}

/// EXECUÇÃO ///

async function main() {
  const args = process.argv.slice(2);
  const argProjeto = args.find(a => a.startsWith('--projeto='));
  const manter = args.includes('--manter');

  const projectId = argProjeto ? argProjeto.split('=')[1] : gerarProjectId();

  const resultados = {};
  const registrar = (chave, ok, detalhe) => {
    resultados[chave] = { ok, detalhe };
  };

  log.titulo('Spike de provisionamento — Fitware');
  log.info(`projectId: ${projectId}`);
  log.info(`location RTDB: ${LOCATION_RTDB}`);

  log.titulo('0. Credencial');
  const credencial = lerCredencialAdc();
  accessToken = await obterAccessToken(credencial);
  log.ok('Access token obtido a partir do ADC do gcloud');

  log.titulo('1. Criar projeto');
  let projectNumber = null;
  try {
    log.passo('cloudresourcemanager.projects.create (pode levar ~30s)…');
    projectNumber = await criarProjeto(projectId);
    log.ok(
      `Projeto criado${projectNumber ? ` (número ${projectNumber})` : ''}`
    );
  } catch (erro) {
    // Com --projeto explícito, reaproveitar um projeto de spike anterior é o
    // comportamento desejado: permite reexecutar só os passos que falharam sem
    // gastar outra vaga da cota. Sem a flag, um ID repetido é acidente e para.
    const jaExiste = /already exists|ALREADY_EXISTS/i.test(erro.message);

    if (argProjeto && jaExiste) {
      log.aviso(`Projeto "${projectId}" já existe — reaproveitando`);
    } else {
      log.erro(`Falhou: ${erro.message}`);
      if (/quota|limit/i.test(erro.message)) {
        log.aviso(
          'Parece cota de projetos esgotada — peça aumento em console.cloud.google.com'
        );
      }
      throw erro;
    }
  }

  // Sem esta checagem o veredito não vale nada: num projeto com billing as
  // duas perguntas respondem "funciona" por motivo errado, já que ambas as
  // limitações que estamos testando só existem no plano Spark.
  log.titulo('1b. Confirmar que o projeto está no Spark');
  const spark = await estaNoSpark(projectId);

  if (spark === true) {
    log.ok(
      'Projeto SEM billing vinculado — está no Spark, o veredito é válido'
    );
  } else if (spark === false) {
    log.erro('Projeto COM billing vinculado (Blaze)');
    log.aviso(
      'O veredito deste spike NÃO será válido: as duas limitações que estamos'
    );
    log.info(
      'testando só existem no Spark. Provavelmente a conta usada tem uma'
    );
    log.info(
      'billing account que se vincula automaticamente a projetos novos.'
    );
    log.info(
      'Use uma conta sem billing account, ou desvincule antes de seguir.'
    );
  } else {
    log.aviso('Não foi possível confirmar o plano do projeto.');
    log.info(
      `Verifique à mão: gcloud beta billing projects describe ${projectId}`
    );
    log.info('O veredito só vale se billingEnabled for false.');
  }

  log.titulo('2. Habilitar APIs');
  log.passo(`serviceusage.batchEnable (${APIS_NECESSARIAS.length} APIs)…`);
  await habilitarApis(projectId);
  log.ok('APIs habilitadas');

  log.titulo('3. Adicionar Firebase');
  log.passo('firebase.projects:addFirebase…');
  await adicionarFirebase(projectId);
  log.ok('Firebase adicionado ao projeto');

  // O addFirebase devolve done antes de os recursos das sub-APIs (RTDB,
  // Identity Toolkit) existirem de fato. Uma pausa aqui evita gastar as
  // tentativas de retry logo na primeira chamada.
  log.passo('aguardando 15s a propagação dos recursos do Firebase…');
  await dormir(15000);

  log.titulo(`4. ${PERGUNTAS.RTDB}   ← PERGUNTA 1`);
  let databaseURL = null;
  try {
    const instancia = await criarRtdb(projectId);
    databaseURL = instancia.databaseUrl;
    log.ok(`RTDB criado: ${databaseURL}`);
    log.info(`type devolvido: ${instancia.type} | state: ${instancia.state}`);
    registrar('RTDB', true, databaseURL);
  } catch (erro) {
    log.erro(`Falhou: ${erro.message}`);
    registrar('RTDB', false, erro.message);
  }

  log.titulo(`5. ${PERGUNTAS.AUTH}   ← PERGUNTA 2`);
  try {
    const config = await habilitarLoginEmailSenha(projectId);
    const habilitado = config?.signIn?.email?.enabled;
    log.ok(`Provider e-mail/senha habilitado (enabled=${habilitado})`);
    registrar('AUTH', true, `enabled=${habilitado}`);
  } catch (erro) {
    log.erro(`Falhou: ${erro.message}`);
    if (/CONFIGURATION_NOT_FOUND/i.test(erro.message)) {
      log.aviso(
        'CONFIGURATION_NOT_FOUND — o Identity Toolkit não tem config inicializada neste projeto.'
      );
    }
    registrar('AUTH', false, erro.message);
  }

  log.titulo('6. Criar app Web e ler config');
  let config = null;
  try {
    const app = await criarAppWeb(projectId);
    config = app.config;
    log.ok(`App Web criado (appId ${app.appId})`);
    log.info(`apiKey:        ${config.apiKey}`);
    log.info(`authDomain:    ${config.authDomain}`);
    log.info(`databaseURL:   ${config.databaseURL ?? '(ausente)'}`);
    log.info(`storageBucket: ${config.storageBucket ?? '(ausente)'}`);
    log.info(`measurementId: ${config.measurementId ?? '(ausente)'}`);

    if (!config.databaseURL) {
      log.aviso(
        'databaseURL ausente no config — esperado se a PERGUNTA 1 falhou.'
      );
    }
    if (!config.storageBucket) {
      log.aviso(
        'storageBucket ausente — esperado no Spark (bucket default exige Blaze desde out/2024).'
      );
    }
  } catch (erro) {
    log.erro(`Falhou: ${erro.message}`);
  }

  // Sonda decisiva: mesmo que o passo 5 tenha falhado, o que interessa é se o
  // app do tenant conseguiria cadastrar um usuário. Se isto funcionar, o passo
  // 5 é dispensável e a PERGUNTA 2 deixa de ser um bloqueio.
  if (config?.apiKey) {
    log.titulo('6b. O cadastro por e-mail/senha funciona de fato?');
    const cadastro = await testarCadastroEmailSenha(config.apiKey);

    if (cadastro.ok) {
      log.ok(`Usuário criado via accounts:signUp (uid ${cadastro.uid})`);
      log.info(
        'O provider e-mail/senha já responde — o passo 5 pode ser dispensável.'
      );
      registrar('AUTH_REAL', true, 'accounts:signUp funcionou');
    } else {
      log.erro(`Falhou: ${cadastro.motivo}`);
      if (/OPERATION_NOT_ALLOWED/i.test(cadastro.motivo)) {
        log.aviso(
          'OPERATION_NOT_ALLOWED — o provider e-mail/senha está mesmo desligado.'
        );
      }
      if (/CONFIGURATION_NOT_FOUND/i.test(cadastro.motivo)) {
        log.aviso(
          'CONFIGURATION_NOT_FOUND — o Authentication nunca foi inicializado neste projeto.'
        );
      }
      registrar('AUTH_REAL', false, cadastro.motivo);
    }
  }

  log.titulo('7. Criar service account e gerar chave');
  try {
    const sa = await criarServiceAccount(projectId);
    log.ok(`Service account criada: ${sa.email}`);
    log.info(
      `chave privada gerada (project_id=${sa.json.project_id}, ${sa.json.private_key.length} chars)`
    );
  } catch (erro) {
    log.erro(`Falhou: ${erro.message}`);
    if (/disableServiceAccountKeyCreation/i.test(erro.message)) {
      log.aviso(
        'Bloqueado por política de organização iam.disableServiceAccountKeyCreation.'
      );
    }
  }

  /// VEREDITO ///

  log.titulo('VEREDITO');
  for (const [chave, pergunta] of Object.entries(PERGUNTAS)) {
    const resultado = resultados[chave];
    if (resultado?.ok) {
      log.ok(`${pergunta} → FUNCIONA no Spark`);
    } else {
      log.erro(`${pergunta} → NÃO funciona`);
      log.info(`motivo: ${resultado?.detalhe ?? 'não executado'}`);
    }
  }

  // O que decide o desenho do produto é o RTDB e o cadastro funcionar de fato.
  // O passo 5 é só o meio de chegar lá: se o cadastro já responde sem ele, ele
  // sai do fluxo e a automação segue completa.
  const authOk = resultados.AUTH?.ok || resultados.AUTH_REAL?.ok;
  const tudoOk = resultados.RTDB?.ok && authOk;

  console.log('');
  if (tudoOk) {
    console.log(
      `${cores.verde}${cores.negrito}Automação 100% viável no Spark.${cores.reset} Seguir o plano sem contingência.`
    );

    if (!resultados.AUTH?.ok && resultados.AUTH_REAL?.ok) {
      log.info(
        'Observação: o PATCH da config falhou, mas o cadastro funciona — remova o passo 5 do fluxo.'
      );
    }
  } else {
    console.log(
      `${cores.amarelo}${cores.negrito}Automação parcial.${cores.reset} As etapas acima viram "ação manual" na tela de progresso.`
    );
  }

  if (!manter) {
    log.titulo('LIMPEZA');
    log.info(`Apague o projeto de teste "${projectId}" em:`);
    log.info('https://console.cloud.google.com/cloud-resource-manager');
    log.info(`Ou: gcloud projects delete ${projectId}`);
  }
}

main().catch(erro => {
  console.error(
    `\n${cores.vermelho}Spike interrompido:${cores.reset} ${erro.message}`
  );
  process.exit(1);
});
