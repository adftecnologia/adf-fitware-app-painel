#!/usr/bin/env node
/**
 * Diagnóstico da configuração do painel.
 *
 * Valida, de baixo para cima, tudo de que a área "Criar Projeto" depende:
 * variáveis de ambiente, chave de criptografia, acesso ao projeto do painel,
 * acesso ao fitmanager-util e a conexão OAuth com o Google. Cada verificação
 * diz exatamente o que fazer quando falha.
 *
 * É somente leitura — não cria, altera nem apaga nada. A única chamada com
 * efeito é a troca do refresh token por um access token, que é justamente o
 * que o cron diário faz para manter a autorização viva.
 *
 * NENHUM segredo é impresso. Chaves e tokens aparecem só como "presente".
 *
 * Uso:
 *   node scripts/validar-configuracao.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { createDecipheriv } = require('node:crypto');

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
  ok: msg => console.log(`${cores.verde}  ✅${cores.reset} ${msg}`),
  erro: msg => console.log(`${cores.vermelho}  ❌${cores.reset} ${msg}`),
  aviso: msg => console.log(`${cores.amarelo}  ⚠️ ${cores.reset} ${msg}`),
  info: msg => console.log(`${cores.cinza}     ${msg}${cores.reset}`),
};

const problemas = [];
const registrarProblema = (o_que, como_resolver) => {
  problemas.push({ o_que, como_resolver });
};

/// ENV ///

/**
 * Lê .env e .env.local sem depender do pacote dotenv, que não é dependência
 * deste projeto. O .env.local tem precedência, como no Vercel CLI.
 */
function carregarEnv() {
  const valores = {};

  for (const arquivo of ['.env', '.env.local']) {
    const caminho = path.resolve(process.cwd(), arquivo);

    if (!fs.existsSync(caminho)) {
      continue;
    }

    for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
      const encontrado = linha.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);

      if (!encontrado) {
        continue;
      }

      valores[encontrado[1]] = encontrado[2].trim().replace(/^["']|["']$/g, '');
    }
  }

  return valores;
}

const OBRIGATORIAS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_DATABASE_URL',
  'CONFIG_FIREBASE_PROJECT_ID',
  'CONFIG_FIREBASE_CLIENT_EMAIL',
  'CONFIG_FIREBASE_PRIVATE_KEY',
  'CONFIG_FIREBASE_DATABASE_URL',
  'TENANT_SA_ENC_KEY',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
];

/// CRIPTOGRAFIA (espelha lib/helper/tenant.helper.ts) ///

function decifrar(payload, chaveBase64) {
  const [iv, authTag, cifrado] = payload.split(':');

  if (!iv || !authTag || !cifrado) {
    throw new Error('Formato inválido. Esperado "iv:authTag:ciphertext".');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(chaveBase64, 'base64'),
    Buffer.from(iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(cifrado, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/// VERIFICAÇÕES ///

function verificarVariaveis(env) {
  log.titulo('1. Variáveis de ambiente');

  const faltando = OBRIGATORIAS.filter(chave => !env[chave]);

  if (faltando.length) {
    log.erro(`Faltam ${faltando.length}: ${faltando.join(', ')}`);
    registrarProblema(
      'Variáveis de ambiente ausentes',
      `Preencha no .env: ${faltando.join(', ')}. Veja .env.example.`
    );
    return false;
  }

  log.ok(`As ${OBRIGATORIAS.length} variáveis obrigatórias estão presentes`);

  // As chaves privadas costumam ser coladas sem as quebras de linha, e o erro
  // só aparece bem depois, ao inicializar o Admin SDK.
  for (const chave of ['FIREBASE_PRIVATE_KEY', 'CONFIG_FIREBASE_PRIVATE_KEY']) {
    if (!env[chave].includes('BEGIN PRIVATE KEY')) {
      log.erro(`${chave} não parece uma chave privada PEM`);
      registrarProblema(
        `${chave} malformada`,
        'Cole o valor do campo private_key do JSON baixado do Firebase, incluindo o cabeçalho BEGIN PRIVATE KEY.'
      );
      return false;
    }
  }

  log.ok('As duas chaves privadas têm formato PEM');
  return true;
}

function verificarChaveCriptografia(env) {
  log.titulo('2. Chave de criptografia (TENANT_SA_ENC_KEY)');

  const bytes = Buffer.from(env.TENANT_SA_ENC_KEY, 'base64');

  if (bytes.length !== 32) {
    log.erro(`Esperados 32 bytes em base64, encontrados ${bytes.length}`);
    registrarProblema(
      'TENANT_SA_ENC_KEY com tamanho errado',
      'Gere uma nova com: openssl rand -base64 32 — mas atenção: trocar a chave torna ilegíveis as credenciais já cifradas.'
    );
    return false;
  }

  log.ok('32 bytes válidos em base64');
  return true;
}

function verificarUrls(env) {
  log.titulo('3. URLs do fluxo OAuth');

  const redirect = env.GOOGLE_OAUTH_REDIRECT_URI;
  const base = env.PAINEL_BASE_URL;

  if (!redirect.endsWith('/api/routes/google-oauth-callback')) {
    log.erro('GOOGLE_OAUTH_REDIRECT_URI não termina no caminho do callback');
    log.info(`valor: ${redirect}`);
    registrarProblema(
      'URI de redirecionamento com caminho errado',
      'Deve terminar exatamente em /api/routes/google-oauth-callback, sem barra final.'
    );
    return false;
  }

  log.ok(`Redirecionamento: ${redirect}`);

  const origemRedirect = new URL(redirect).origin;
  const ehLocal = origemRedirect.includes('localhost');

  if (base) {
    log.ok(`Interface do painel: ${base}`);

    if (!ehLocal && new URL(base).origin === origemRedirect) {
      log.aviso(
        'PAINEL_BASE_URL é igual à origem do redirecionamento — em produção pode ser removida'
      );
    }
  } else if (ehLocal) {
    log.erro('PAINEL_BASE_URL ausente com redirecionamento em localhost');
    log.info(
      'Local, a interface (:4200) e as funções (:3001) ficam em portas diferentes.'
    );
    registrarProblema(
      'PAINEL_BASE_URL ausente em desenvolvimento',
      'Adicione PAINEL_BASE_URL=http://localhost:4200 ao .env, senão o retorno do Google cai na porta errada.'
    );
    return false;
  } else {
    log.ok('Sem PAINEL_BASE_URL — o retorno usa a origem do redirecionamento');
  }

  log.info('');
  log.info('Esta URI precisa estar cadastrada, idêntica, em:');
  log.info(
    `https://console.cloud.google.com/auth/clients?project=${env.CONFIG_FIREBASE_PROJECT_ID}`
  );

  return true;
}

async function verificarFirebase(env) {
  log.titulo('4. Acesso aos projetos Firebase');

  const { initializeApp, cert } = require('firebase-admin/app');
  const { getDatabase } = require('firebase-admin/database');
  const { getAuth } = require('firebase-admin/auth');

  const projetos = [
    {
      nome: 'painel (login e usuários)',
      appName: 'painel',
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
      databaseURL: env.FIREBASE_DATABASE_URL,
    },
    {
      nome: 'fitmanager-util (tenants e environments)',
      appName: 'config',
      projectId: env.CONFIG_FIREBASE_PROJECT_ID,
      clientEmail: env.CONFIG_FIREBASE_CLIENT_EMAIL,
      privateKey: env.CONFIG_FIREBASE_PRIVATE_KEY,
      databaseURL: env.CONFIG_FIREBASE_DATABASE_URL,
    },
  ];

  const apps = {};
  let tudoOk = true;

  for (const projeto of projetos) {
    try {
      apps[projeto.appName] = initializeApp(
        {
          credential: cert({
            projectId: projeto.projectId,
            clientEmail: projeto.clientEmail,
            privateKey: projeto.privateKey.replace(/\\n/g, '\n'),
          }),
          databaseURL: projeto.databaseURL,
        },
        projeto.appName
      );

      // Exercita a credencial de verdade: initializeApp sozinho não valida nada.
      await getAuth(apps[projeto.appName]).listUsers(1);

      log.ok(`${projeto.nome} — ${projeto.projectId}`);
    } catch (erro) {
      log.erro(`${projeto.nome}: ${erro.message}`);
      registrarProblema(
        `Sem acesso ao projeto ${projeto.projectId}`,
        'Confira as variáveis desse projeto no .env. Se a chave foi revogada, gere outra no console do Firebase.'
      );
      tudoOk = false;
    }
  }

  if (!apps.config) {
    return { ok: false, apps };
  }

  // Panorama do que já está cadastrado — útil para saber se o painel está
  // apontando para o ambiente que você imagina.
  try {
    const database = getDatabase(apps.config);
    const contagens = {};

    for (const no of [
      'clientes/serviceAccounts',
      'clientes/firebaseConfigs',
      'clientes/provisionamentos',
    ]) {
      const snapshot = await database.ref(no).once('value');
      contagens[no] = Object.keys(snapshot.val() ?? {}).length;
    }

    log.info('');
    for (const [no, total] of Object.entries(contagens)) {
      log.info(`${no}: ${total} registro(s)`);
    }
  } catch (erro) {
    log.aviso(`Não foi possível ler os nós de configuração: ${erro.message}`);
  }

  return { ok: tudoOk, apps };
}

async function verificarConexaoGoogle(env, apps) {
  log.titulo('5. Conexão OAuth com o Google');

  if (!apps.config) {
    log.aviso('Pulado: sem acesso ao fitmanager-util');
    return false;
  }

  const { getDatabase } = require('firebase-admin/database');

  const snapshot = await getDatabase(apps.config)
    .ref('clientes/googleOAuth/provisionador')
    .once('value');

  const registro = snapshot.val();

  if (!registro) {
    log.aviso('Nenhuma conta Google conectada ainda');
    log.info(
      'Isto é esperado antes do primeiro uso. Conecte pela tela "Criar Projeto".'
    );
    return false;
  }

  log.ok(`Conta conectada: ${registro.email || '(e-mail não registrado)'}`);
  log.info(`conectado em: ${registro.conectadoEm}`);
  log.info(`status: ${registro.statusConexao}`);

  if (registro.ultimaRenovacao) {
    log.info(`última renovação: ${registro.ultimaRenovacao}`);
  }

  if (registro.statusConexao === 'EXPIRADA') {
    log.erro('A conexão está marcada como EXPIRADA');
    log.info(registro.ultimoErro ?? '');
    registrarProblema(
      'Autorização do Google expirada ou revogada',
      'Reconecte a conta na tela "Criar Projeto".'
    );
    return false;
  }

  let refreshToken;

  try {
    refreshToken = decifrar(registro.refreshTokenEnc, env.TENANT_SA_ENC_KEY);
    log.ok('Refresh token decifrado com a chave atual');
  } catch (erro) {
    log.erro(`Falha ao decifrar o refresh token: ${erro.message}`);
    registrarProblema(
      'Refresh token ilegível',
      'A TENANT_SA_ENC_KEY provavelmente mudou depois da conexão. Reconecte a conta na tela "Criar Projeto".'
    );
    return false;
  }

  // Mesma chamada do cron diário: confirma que a autorização segue válida.
  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    log.erro(`O Google recusou o refresh token: ${dados.error}`);
    log.info(dados.error_description ?? '');

    registrarProblema(
      'Refresh token recusado pelo Google',
      dados.error === 'invalid_grant'
        ? 'Foi revogado ou expirou (7 dias, se a tela de consentimento estiver em "Testes"). Publique o app e reconecte.'
        : 'Confira GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET — precisam ser do mesmo OAuth Client usado na conexão.'
    );
    return false;
  }

  log.ok('Access token obtido — a autorização está válida');

  // Os escopos efetivamente concedidos podem ser menores que os pedidos, se o
  // usuário desmarcou algo na tela de consentimento. Sem cloud-platform, a
  // criação de projetos falha com "The caller does not have permission" — e o
  // erro não diz que o problema é escopo.
  const ESCOPOS_NECESSARIOS = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase',
  ];

  const info = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${dados.access_token}`
  );

  if (info.ok) {
    const concedidos = ((await info.json()).scope ?? '').split(' ');
    const faltando = ESCOPOS_NECESSARIOS.filter(
      escopo => !concedidos.includes(escopo)
    );

    if (faltando.length) {
      log.erro(`Escopos concedidos não incluem: ${faltando.join(', ')}`);
      log.info(`concedidos: ${concedidos.join(', ')}`);
      registrarProblema(
        'Escopos insuficientes na autorização',
        'Desconecte na tela "Criar Projeto", revogue o acesso em myaccount.google.com/permissions e conecte de novo, aceitando todas as permissões pedidas.'
      );
      return false;
    }

    log.ok('Escopos concedidos incluem cloud-platform e firebase');
  } else {
    log.aviso('Não foi possível conferir os escopos concedidos');
  }

  // Confirma que o token realmente alcança as APIs do provisionamento.
  const projetos = await fetch(
    'https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=1',
    { headers: { Authorization: `Bearer ${dados.access_token}` } }
  );

  if (projetos.ok) {
    log.ok('O token responde no Cloud Resource Manager');
  } else {
    const erro = await projetos.json();
    log.erro(`Sem acesso ao Resource Manager: ${erro?.error?.message}`);
    registrarProblema(
      'Resource Manager inacessível',
      'Confirme que a API cloudresourcemanager.googleapis.com está habilitada no projeto do OAuth Client.'
    );
    return false;
  }

  return true;
}

/// EXECUÇÃO ///

async function main() {
  console.log(
    `\n${cores.negrito}Diagnóstico da configuração — Painel Fitware${cores.reset}`
  );
  console.log(
    `${cores.cinza}somente leitura, nenhum segredo é impresso${cores.reset}`
  );

  const env = carregarEnv();

  if (!verificarVariaveis(env)) {
    return resumir();
  }

  if (!verificarChaveCriptografia(env)) {
    return resumir();
  }

  verificarUrls(env);

  const { apps } = await verificarFirebase(env);

  await verificarConexaoGoogle(env, apps);

  resumir();
}

function resumir() {
  log.titulo('RESUMO');

  if (!problemas.length) {
    console.log(
      `${cores.verde}${cores.negrito}  Configuração completa.${cores.reset} Nada bloqueia a criação de projetos.`
    );
    return;
  }

  console.log(
    `${cores.vermelho}${cores.negrito}  ${problemas.length} ponto(s) a resolver:${cores.reset}\n`
  );

  problemas.forEach(({ o_que, como_resolver }, indice) => {
    console.log(`  ${indice + 1}. ${cores.negrito}${o_que}${cores.reset}`);
    console.log(`     ${cores.cinza}${como_resolver}${cores.reset}\n`);
  });
}

main()
  .then(() => process.exit(0))
  .catch(erro => {
    console.error(
      `\n${cores.vermelho}Diagnóstico interrompido:${cores.reset} ${erro.message}`
    );
    process.exit(1);
  });
