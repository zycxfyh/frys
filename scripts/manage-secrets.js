#!/usr/bin/env node

/**
 * frys Secret Manager CLI
 * Herramienta de línea de comandos para gestionar secretos de manera segura
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';
import {
  getSecretManager,
  SecretManager,
} from '../src/utils/secret-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    showHelp();
    process.exit(1);
  }

  try {
    const manager = getSecretManager();

    switch (command) {
      case 'list':
        await listSecrets(manager);
        break;

      case 'get':
        await getSecret(manager, args[1]);
        break;

      case 'set':
        await setSecret(manager, args[1], args[2]);
        break;

      case 'delete':
        await deleteSecret(manager, args[1]);
        break;

      case 'rotate':
        await rotateSecret(manager, args[1]);
        break;

      case 'import':
        await importSecrets(manager, args[1]);
        break;

      case 'export':
        await exportSecrets(manager, args[1]);
        break;

      case 'backup':
        await backupSecrets(manager, args[1]);
        break;

      case 'restore':
        await restoreSecrets(manager, args[1]);
        break;

      case 'stats':
        showStats(manager);
        break;

      case 'init':
        await initializeSecrets(manager);
        break;

      default:
        console.error(`Comando desconocido: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Lista todos los secretos disponibles
 */
async function listSecrets(manager) {
  console.log('🔐 Secretos disponibles:');
  console.log('='.repeat(50));

  // Lista de secretos conocidos
  const knownSecrets = [
    'jwt_secret',
    'db_password',
    'cache_password',
    'openai_api_key',
    'claude_api_key',
    'gemini_api_key',
    'deepseek_api_key',
    'alibaba_api_key',
    'cognee_api_key',
    'email_password',
    'slack_webhook_url',
  ];

  for (const secretKey of knownSecrets) {
    try {
      const value = await manager.getSecret(secretKey);
      const masked = value
        ? '*'.repeat(Math.min(value.length, 20))
        : '(no configurado)';
      console.log(`${secretKey.padEnd(20)}: ${masked}`);
    } catch (error) {
      console.log(`${secretKey.padEnd(20)}: (error)`);
    }
  }
}

/**
 * Obtiene un secreto específico
 */
async function getSecret(manager, key) {
  if (!key) {
    console.error('Error: Especifica el nombre del secreto');
    console.log('Uso: npm run secrets get <key>');
    process.exit(1);
  }

  try {
    const value = await manager.getSecret(key);
    if (value) {
      console.log(`${key}: ${value}`);
    } else {
      console.log(`${key}: (no configurado)`);
    }
  } catch (error) {
    console.error(`Error obteniendo secreto ${key}:`, error.message);
  }
}

/**
 * Establece un secreto
 */
async function setSecret(manager, key, value) {
  if (!key || !value) {
    console.error('Error: Especifica el nombre y valor del secreto');
    console.log('Uso: npm run secrets set <key> <value>');
    process.exit(1);
  }

  try {
    await manager.setSecret(key, value);
    console.log(`✅ Secreto ${key} establecido`);
  } catch (error) {
    console.error(`Error estableciendo secreto ${key}:`, error.message);
  }
}

/**
 * Elimina un secreto (solo para algunos providers)
 */
async function deleteSecret(manager, key) {
  if (!key) {
    console.error('Error: Especifica el nombre del secreto');
    process.exit(1);
  }

  // Nota: Esta funcionalidad depende del provider
  console.log('⚠️  Eliminación de secretos no implementada para este provider');
}

/**
 * Rota un secreto generando uno nuevo
 */
async function rotateSecret(manager, key) {
  if (!key) {
    console.error('Error: Especifica el nombre del secreto');
    process.exit(1);
  }

  try {
    const generators = {
      jwt_secret: () => require('crypto').randomBytes(32).toString('hex'),
      db_password: () => generatePassword(16),
      cache_password: () => generatePassword(16),
      openai_api_key: () =>
        'sk-' + require('crypto').randomBytes(32).toString('hex'),
      claude_api_key: () => require('crypto').randomBytes(32).toString('hex'),
      gemini_api_key: () => require('crypto').randomBytes(32).toString('hex'),
      email_password: () => generatePassword(12),
      slack_webhook_url: () => 'https://example.com/webhook/placeholder',
    };

    const generator =
      generators[key] ||
      (() => require('crypto').randomBytes(16).toString('hex'));
    const newValue = await manager.rotateSecret(key, generator);

    console.log(`🔄 Secreto ${key} rotado`);
    console.log(`Nuevo valor: ${newValue}`);
  } catch (error) {
    console.error(`Error rotando secreto ${key}:`, error.message);
  }
}

/**
 * Importa secretos desde un archivo JSON
 */
async function importSecrets(manager, filePath) {
  if (!filePath) {
    console.error('Error: Especifica la ruta del archivo');
    process.exit(1);
  }

  try {
    const data = readFileSync(filePath, 'utf8');
    const secrets = JSON.parse(data);

    let imported = 0;
    for (const [key, value] of Object.entries(secrets)) {
      if (typeof value === 'string' && value.length > 0) {
        await manager.setSecret(key, value);
        imported++;
      }
    }

    console.log(`✅ Importados ${imported} secretos desde ${filePath}`);
  } catch (error) {
    console.error('Error importando secretos:', error.message);
  }
}

/**
 * Exporta secretos a un archivo JSON
 */
async function exportSecrets(manager, filePath) {
  console.log('⚠️  Exportación de secretos no implementada por seguridad');
  console.log('Usa backup para crear copias de seguridad encriptadas');
}

/**
 * Crea una copia de seguridad de los secretos
 */
async function backupSecrets(manager, filePath) {
  const backupPath =
    filePath ||
    `./secrets-backup-${new Date().toISOString().split('T')[0]}.enc`;

  try {
    // Esta funcionalidad depende del provider
    console.log(
      `⚠️  Copia de seguridad no implementada para provider ${manager.provider}`,
    );
    console.log(
      'Para encrypted-file provider, el archivo .secrets.enc ya es una copia de seguridad encriptada',
    );
  } catch (error) {
    console.error('Error creando copia de seguridad:', error.message);
  }
}

/**
 * Restaura secretos desde una copia de seguridad
 */
async function restoreSecrets(manager, filePath) {
  if (!filePath) {
    console.error('Error: Especifica la ruta del archivo de respaldo');
    process.exit(1);
  }

  console.log('⚠️  Restauración de secretos no implementada');
}

/**
 * Muestra estadísticas del secret manager
 */
function showStats(manager) {
  const stats = manager.getStats();
  console.log('🔐 Secret Manager Stats:');
  console.log('='.repeat(30));
  console.log(`Provider: ${stats.provider}`);
  console.log(`Cache size: ${stats.cache_size}`);
  console.log(`Cache TTL: ${stats.cache_ttl}ms`);
  console.log(`Encrypted file exists: ${stats.secrets_file_exists}`);
  console.log(`Plaintext file exists: ${stats.plaintext_file_exists}`);
}

/**
 * Inicializa secretos por defecto para desarrollo
 */
async function initializeSecrets(manager) {
  console.log('🔧 Inicializando secretos por defecto...');

  const defaults = {
    jwt_secret: require('crypto').randomBytes(32).toString('hex'),
    db_password: generatePassword(16),
    cache_password: generatePassword(16),
  };

  let initialized = 0;
  for (const [key, value] of Object.entries(defaults)) {
    try {
      await manager.setSecret(key, value);
      console.log(`✅ ${key} inicializado`);
      initialized++;
    } catch (error) {
      console.log(`⚠️  ${key} ya existe o error: ${error.message}`);
    }
  }

  console.log(`🎉 Inicializados ${initialized} secretos por defecto`);
  console.log('');
  console.log(
    '⚠️  IMPORTANTE: En producción, configura los siguientes secretos:',
  );
  console.log('   - openai_api_key (para OpenAI)');
  console.log('   - claude_api_key (para Anthropic Claude)');
  console.log('   - gemini_api_key (para Google Gemini)');
  console.log('   - email_password (para notificaciones por email)');
  console.log('   - slack_webhook_url (para notificaciones Slack)');
}

/**
 * Genera una contraseña segura
 */
function generatePassword(length = 12) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Muestra la ayuda
 */
function showHelp() {
  console.log(`
🔐 frys Secret Manager CLI

USAGE:
    node scripts/manage-secrets.js <command> [options]

COMMANDS:
    list                    Lista todos los secretos disponibles
    get <key>               Obtiene el valor de un secreto
    set <key> <value>       Establece el valor de un secreto
    rotate <key>            Rota un secreto generando uno nuevo
    import <file>           Importa secretos desde un archivo JSON
    export <file>           Exporta secretos a un archivo JSON
    backup [file]           Crea una copia de seguridad encriptada
    restore <file>          Restaura desde una copia de seguridad
    stats                   Muestra estadísticas del secret manager
    init                    Inicializa secretos por defecto para desarrollo

EXAMPLES:
    node scripts/manage-secrets.js list
    node scripts/manage-secrets.js get jwt_secret
    node scripts/manage-secrets.js set openai_api_key sk-your-key-here
    node scripts/manage-secrets.js rotate db_password
    node scripts/manage-secrets.js init

ENVIRONMENT VARIABLES:
    SECRETS_PROVIDER        Provider a usar (encrypted-file, aws-secrets-manager, etc.)
    AWS_REGION              Región de AWS (para AWS provider)
    VAULT_ADDR              URL de Vault (para HashiCorp Vault)
    AZURE_KEYVAULT_NAME     Nombre del Key Vault (para Azure)

SECURITY NOTES:
    - Los secretos nunca se muestran en logs
    - Usa encrypted-file provider para desarrollo
    - Usa servicios gestionados (AWS, Vault, Azure) en producción
    - Rota los secretos regularmente
  `);
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
}

export { main };
