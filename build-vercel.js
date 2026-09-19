#!/usr/bin/env node

/**
 * Script de build inteligente para Vercel
 * Compila Angular + API TypeScript baseado no ambiente
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Detectar ambiente baseado nas variáveis da Vercel
const isProduction = process.env.VERCEL_ENV === 'production';
const isPreview = process.env.VERCEL_ENV === 'preview';
const gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
const isLocal = !process.env.VERCEL_ENV;

console.log('🔍 Detectando ambiente...');
console.log('VERCEL_ENV:', process.env.VERCEL_ENV || 'LOCAL');
console.log('Git Branch:', gitBranch || 'N/A');
console.log('Is Local:', isLocal);

let buildCommand;
let environmentName;

if (isProduction || ['main', 'master'].includes(gitBranch)) {
  buildCommand = 'npm run build:prod';
  environmentName = 'PRODUCTION';
} else {
  buildCommand = 'npm run build:dev';
  environmentName = 'DEVELOPMENT';
}

console.log(`🚀 Iniciando build completo para ${environmentName}...`);

try {
  // 1. Atualizar configurações de ambiente com valores da Vercel
  const tenantId = process.env.VERCEL_TENANT_ID;
  const apiKey = process.env.VERCEL_API_KEY;

  if (tenantId && apiKey) {
    console.log('🔧 Configurando tenantId e apiKey das variáveis da Vercel...');
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   API Key: ${apiKey.substring(0, 10)}...`);

    // Determinar qual arquivo de environment usar
    const envFile =
      isProduction || ['main', 'master'].includes(gitBranch)
        ? 'src/environments/environment.prod.ts'
        : 'src/environments/environment.dev.ts';

    console.log(`   Atualizando: ${envFile}`);

    // Ler o arquivo de environment
    let envContent = fs.readFileSync(envFile, 'utf8');

    // Substituir tenantId, apiKey e recaptchaSiteKey
    envContent = envContent.replace(
      /tenantId:\s*['"][^'"]*['"]/,
      `tenantId: '${tenantId}'`
    );
    envContent = envContent.replace(
      /(srvCatra:\s*\{[^}]*apiKey:\s*)['"][^'"]*['"]/,
      `$1'${apiKey}'`
    );

    // Salvar o arquivo atualizado
    fs.writeFileSync(envFile, envContent, 'utf8');
    console.log('✅ Configurações atualizadas com sucesso!');
  } else {
    //console.log("ℹ️  Usando configurações padrão (variáveis Vercel não encontradas)",);
    throw new Error(
      `Variáveis de ambiente Vercel não encontradas. Configurar 'VERCEL_TENANT_ID' e 'VERCEL_API_KEY'`
    );
  }

  // 1. Limpar diretório dist
  console.log('🧹 Limpando diretório dist...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  fs.mkdirSync('dist', { recursive: true });

  // 2. Build da API TypeScript
  console.log('⚙️ Compilando API TypeScript...');
  execSync('npm run build:api', { stdio: 'inherit' });

  // Verificar se o build da API funcionou
  const apiOutputPath = 'dist/api';
  if (fs.existsSync(apiOutputPath)) {
    console.log(`✅ API compilada com sucesso em: ${apiOutputPath}`);
  } else {
    throw new Error('Falha na compilação da API TypeScript');
  }

  // 3. Build do Angular
  console.log(`📦 Executando build Angular: ${buildCommand}`);
  execSync(buildCommand, { stdio: 'inherit' });

  // Verificar se o build do Angular funcionou
  const angularOutputPath = 'dist/painel-configuracao-fitware';
  const angularBrowserPath =
    'dist/painel-configuracao-fitware/browser';

  if (
    fs.existsSync(angularBrowserPath) &&
    fs.existsSync(path.join(angularBrowserPath, 'index.html'))
  ) {
    console.log(`✅ Angular buildado com sucesso em: ${angularBrowserPath}`);
  } else if (fs.existsSync(angularOutputPath)) {
    console.log(`✅ Angular buildado com sucesso em: ${angularOutputPath}`);
  } else {
    throw new Error(`Angular build não encontrado em: ${angularOutputPath}`);
  }

  // 4. Resumo final
  console.log('\n🎉 Build completo finalizado com sucesso!');
  console.log('📁 Estrutura gerada:');
  console.log('├── dist/api/              # API TypeScript compilada');
  console.log(
    '└── dist/painel-configuracao-fitware/browser/  # Angular buildado'
  );

  // 5. Estatísticas
  const apiFiles = getFileCount('dist/api');
  const angularFiles = getFileCount(
    'dist/painel-configuracao-fitware'
  );

  console.log(`\n📊 Estatísticas:`);
  console.log(`   API: ${apiFiles} arquivos compilados`);
  console.log(`   Angular: ${angularFiles} arquivos gerados`);
  console.log(`   Ambiente: ${environmentName}`);
  console.log(
    `   Output: dist/painel-configuracao-fitware/browser/index.html`
  );
} catch (error) {
  console.error('\n❌ Erro no build:', error.message);
  console.error('\n🔧 Possíveis soluções:');
  console.error('   1. Verificar erros TypeScript na pasta api/');
  console.error('   2. Executar: npm install');
  console.error('   3. Verificar se as dependências estão instaladas');
  process.exit(1);
}

// Função auxiliar para contar arquivos
function getFileCount(dir) {
  if (!fs.existsSync(dir)) return 0;

  let count = 0;
  function countFiles(currentDir) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const itemPath = path.join(currentDir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        countFiles(itemPath);
      } else {
        count++;
      }
    }
  }
  countFiles(dir);
  return count;
}
