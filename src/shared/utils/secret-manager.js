/**
 * 🔒 frys Secret Manager
 * 安全管理API密钥和其他敏感信息
 *
 * 支持多种后端：
 * - Environment variables (desarrollo)
 * - Encrypted local file (desarrollo)
 * - AWS Secrets Manager (producción)
 * - HashiCorp Vault (producción)
 * - Azure Key Vault (producción)
 */

import crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🔐 Constantes de seguridad
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

/**
 * Secret Manager principal
 */
export class SecretManager {
  constructor(options = {}) {
    this.provider = options.provider || this.detectProvider();
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutos
    this.encryptionKey = this.getEncryptionKey();

    // Configurar el provider específico
    this.setupProvider();

    logger.info(
      `🔐 Secret Manager inicializado con provider: ${this.provider}`,
    );
  }

  /**
   * Detecta automáticamente el provider basado en el entorno
   */
  detectProvider() {
    const env = process.env.NODE_ENV || 'development';

    // En producción, preferir servicios gestionados
    if (env === 'production') {
      if (process.env.AWS_REGION) return 'aws-secrets-manager';
      if (process.env.VAULT_ADDR) return 'hashicorp-vault';
      if (process.env.AZURE_CLIENT_ID) return 'azure-key-vault';
    }

    // En desarrollo, usar archivo encriptado local
    return 'encrypted-file';
  }

  /**
   * Obtiene la clave de encriptación con validación de seguridad
   */
  getEncryptionKey() {
    const env = process.env.NODE_ENV || 'development';

    // En producción, FRYS_ENCRYPTION_KEY es obligatorio
    if (env === 'production') {
      const key = process.env.FRYS_ENCRYPTION_KEY;
      if (!key) {
        throw new Error(
          'FRYS_ENCRYPTION_KEY es requerido en producción. ' +
            'Configure una clave de encriptación segura de 32 bytes (256 bits).',
        );
      }

      // Validar que la clave tenga la longitud correcta
      if (key.length !== 64) {
        // 32 bytes en hex = 64 caracteres
        throw new Error(
          'FRYS_ENCRYPTION_KEY debe ser una clave de 32 bytes (64 caracteres hexadecimales)',
        );
      }

      return key;
    }

    // En desarrollo y testing, permitir clave derivada pero con advertencia
    const key = process.env.FRYS_ENCRYPTION_KEY;
    if (key) {
      if (key.length !== 64) {
        throw new Error(
          'FRYS_ENCRYPTION_KEY debe ser una clave de 32 bytes (64 caracteres hexadecimales)',
        );
      }
      return key;
    }

    // SECURITY: 移除危险的密钥派生逻辑
    // 在开发环境中也不允许使用可预测的密钥
    logger.error('🚫 FRYS_ENCRYPTION_KEY 未配置');
    logger.error('🚫 无法使用不安全的密钥派生机制');
    logger.error('🚫 请设置 FRYS_ENCRYPTION_KEY 为32字节的随机hex字符串');

    throw new Error(
      'FRYS_ENCRYPTION_KEY 是必需的环境变量。' +
        '请生成一个安全的随机密钥: openssl rand -hex 32',
    );
  }

  /**
   * Configura el provider específico
   */
  async setupProvider() {
    switch (this.provider) {
      case 'aws-secrets-manager':
        await this.setupAWSSecretsManager();
        break;
      case 'hashicorp-vault':
        await this.setupHashiCorpVault();
        break;
      case 'azure-key-vault':
        await this.setupAzureKeyVault();
        break;
      case 'encrypted-file':
      default:
        this.setupEncryptedFile();
        break;
    }
  }

  /**
   * Configuración para AWS Secrets Manager
   */
  async setupAWSSecretsManager() {
    try {
      // AWS SDK se cargará dinámicamente para evitar dependencias innecesarias
      const { SecretsManagerClient } = await import(
        '@aws-sdk/client-secrets-manager'
      );
      this.awsClient = new SecretsManagerClient({
        region: process.env.AWS_REGION,
      });
      logger.info('✅ AWS Secrets Manager configurado');
    } catch (error) {
      logger.error('❌ Error configurando AWS Secrets Manager:', error.message);
      throw error;
    }
  }

  /**
   * Configuración para HashiCorp Vault
   */
  async setupHashiCorpVault() {
    try {
      const vault = await import('node-vault');
      this.vaultClient = vault.default({
        endpoint: process.env.VAULT_ADDR,
        token: process.env.VAULT_TOKEN,
      });
      logger.info('✅ HashiCorp Vault configurado');
    } catch (error) {
      logger.error('❌ Error configurando HashiCorp Vault:', error.message);
      throw error;
    }
  }

  /**
   * Configuración para Azure Key Vault
   */
  async setupAzureKeyVault() {
    try {
      const { SecretClient } = await import('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = await import('@azure/identity');

      const credential = new DefaultAzureCredential();
      const vaultUrl = `https://${process.env.AZURE_KEYVAULT_NAME}.vault.azure.net`;
      this.azureClient = new SecretClient(vaultUrl, credential);
      logger.info('✅ Azure Key Vault configurado');
    } catch (error) {
      logger.error('❌ Error configurando Azure Key Vault:', error.message);
      throw error;
    }
  }

  /**
   * Configuración para archivo encriptado local
   */
  setupEncryptedFile() {
    this.secretsFile = join(__dirname, '../../.secrets.enc');
    this.plaintextFile = join(__dirname, '../../.secrets.json');

    // Crear archivo de secretos si no existe
    if (!existsSync(this.secretsFile) && !existsSync(this.plaintextFile)) {
      this.createDefaultSecretsFile();
    }

    logger.info('✅ Encrypted file provider configurado');
  }

  /**
   * Crea archivo de secretos por defecto para desarrollo (SECURITY: Removido)
   * Esta función ha sido removida por razones de seguridad.
   * Nunca crear archivos de texto plano con secretos.
   */
  createDefaultSecretsFile() {
    const env = process.env.NODE_ENV || 'development';

    // En producción, nunca crear archivos de texto plano
    if (env === 'production') {
      logger.error(
        '🚫 Intento de crear archivo de secretos plano en producción - DENEGADO',
      );
      throw new Error(
        'No se pueden crear archivos de secretos planos en producción',
      );
    }

    // En desarrollo, mostrar advertencia fuerte y no crear archivo
    logger.error(
      '🚫 Creación de archivos de secretos planos está DESHABILITADA por seguridad',
    );
    logger.error(
      '🚫 Configure sus secretos usando variables de entorno o archivos encriptados',
    );

    // En lugar de crear archivo plano, crear un archivo vacío con instrucciones
    const instructions = {
      warning: 'NO USE ESTE ARCHIVO PARA SECRETOS',
      instructions: [
        'Configure variables de entorno para sus secretos',
        'O use archivos encriptados con el SecretManager',
        'Nunca commit archivos con secretos reales',
        'Consulte la documentación de seguridad',
      ],
      created_at: new Date().toISOString(),
      environment: env,
    };

    writeFileSync(this.plaintextFile, JSON.stringify(instructions, null, 2));
    logger.warn(
      '📝 Archivo de instrucciones creado (NO contiene secretos reales)',
    );
  }

  /**
   * Obtiene un secreto por su clave
   */
  async getSecret(key, options = {}) {
    const cacheKey = `${this.provider}:${key}`;

    // Verificar caché primero
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    let value;

    try {
      switch (this.provider) {
        case 'aws-secrets-manager':
          value = await this.getFromAWSSecretsManager(key);
          break;
        case 'hashicorp-vault':
          value = await this.getFromHashiCorpVault(key);
          break;
        case 'azure-key-vault':
          value = await this.getFromAzureKeyVault(key);
          break;
        case 'encrypted-file':
        default:
          value = await this.getFromEncryptedFile(key);
          break;
      }

      // Cachear el resultado
      this.cache.set(cacheKey, {
        value,
        timestamp: Date.now(),
      });

      // Logging seguro (no mostrar el valor real)
      logger.debug(`🔐 Secreto obtenido: ${key} (${this.provider})`);

      return value;
    } catch (error) {
      logger.error(`❌ Error obteniendo secreto ${key}:`, error.message);

      // Si no es crítico, devolver valor por defecto
      if (options.defaultValue !== undefined) {
        logger.warn(`⚠️ Usando valor por defecto para secreto: ${key}`);
        return options.defaultValue;
      }

      throw error;
    }
  }

  /**
   * Establece un secreto
   */
  async setSecret(key, value) {
    try {
      switch (this.provider) {
        case 'aws-secrets-manager':
          await this.setInAWSSecretsManager(key, value);
          break;
        case 'hashicorp-vault':
          await this.setInHashiCorpVault(key, value);
          break;
        case 'azure-key-vault':
          await this.setInAzureKeyVault(key, value);
          break;
        case 'encrypted-file':
        default:
          await this.setInEncryptedFile(key, value);
          break;
      }

      // Invalidar caché
      this.cache.delete(`${this.provider}:${key}`);

      logger.info(`🔐 Secreto establecido: ${key} (${this.provider})`);
    } catch (error) {
      logger.error(`❌ Error estableciendo secreto ${key}:`, error.message);
      throw error;
    }
  }

  /**
   * Rota un secreto (genera nuevo valor)
   */
  async rotateSecret(key, generator) {
    try {
      const newValue = generator ? generator() : this.generateSecret();
      await this.setSecret(key, newValue);

      logger.info(`🔄 Secreto rotado: ${key}`);
      return newValue;
    } catch (error) {
      logger.error(`❌ Error rotando secreto ${key}:`, error.message);
      throw error;
    }
  }

  /**
   * Genera un secreto aleatorio
   */
  generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // === PROVIDERS ESPECÍFICOS ===

  /**
   * AWS Secrets Manager implementation
   */
  async getFromAWSSecretsManager(key) {
    const { GetSecretValueCommand } = await import(
      '@aws-sdk/client-secrets-manager'
    );
    const command = new GetSecretValueCommand({
      SecretId: `frys/${process.env.NODE_ENV}/${key}`,
    });

    const response = await this.awsClient.send(command);
    return response.SecretString;
  }

  async setInAWSSecretsManager(key, value) {
    const { UpdateSecretCommand } = await import(
      '@aws-sdk/client-secrets-manager'
    );
    const command = new UpdateSecretCommand({
      SecretId: `frys/${process.env.NODE_ENV}/${key}`,
      SecretString: value,
    });

    await this.awsClient.send(command);
  }

  /**
   * HashiCorp Vault implementation
   */
  async getFromHashiCorpVault(key) {
    const result = await this.vaultClient.read(`secret/frys/${key}`);
    return result.data.value;
  }

  async setInHashiCorpVault(key, value) {
    await this.vaultClient.write(`secret/frys/${key}`, { value });
  }

  /**
   * Azure Key Vault implementation
   */
  async getFromAzureKeyVault(key) {
    const secret = await this.azureClient.getSecret(key);
    return secret.value;
  }

  async setInAzureKeyVault(key, value) {
    await this.azureClient.setSecret(key, value);
  }

  /**
   * Encrypted file implementation
   */
  async getFromEncryptedFile(key) {
    // Primero intentar archivo encriptado
    if (existsSync(this.secretsFile)) {
      const encryptedData = readFileSync(this.secretsFile);
      const secrets = JSON.parse(this.decrypt(encryptedData));
      return secrets[key];
    }

    // Fallback a archivo plano (desarrollo)
    if (existsSync(this.plaintextFile)) {
      const secrets = JSON.parse(readFileSync(this.plaintextFile, 'utf8'));
      return secrets[key];
    }

    throw new Error(`Secreto no encontrado: ${key}`);
  }

  async setInEncryptedFile(key, value) {
    let secrets = {};
    let existingSecretsLoaded = false;

    // Leer secretos existentes
    try {
      if (existsSync(this.secretsFile)) {
        const encryptedData = readFileSync(this.secretsFile);
        secrets = JSON.parse(this.decrypt(encryptedData));
        existingSecretsLoaded = true;
        logger.debug('成功加载现有的加密秘密文件');
      } else if (existsSync(this.plaintextFile)) {
        secrets = JSON.parse(readFileSync(this.plaintextFile, 'utf8'));
        existingSecretsLoaded = true;
        logger.debug('成功加载现有的纯文本秘密文件');
      }
    } catch (error) {
      // 🔒 安全修复：读取失败时抛出错误而不是静默忽略
      logger.error('❌ 读取现有秘密文件失败:', error.message);
      logger.error('❌ 为防止数据丢失，拒绝保存新的秘密');

      // 提供恢复建议
      if (existsSync(this.secretsFile)) {
        logger.error('💡 建议检查加密密钥是否正确: openssl rand -hex 32');
      }
      if (existsSync(this.plaintextFile)) {
        logger.error('💡 建议手动备份纯文本文件内容，然后删除文件');
      }

      throw new Error(
        `无法读取现有秘密文件，拒绝保存以防止数据丢失: ${error.message}`,
      );
    }

    // Actualizar secreto
    secrets[key] = value;
    secrets.updated_at = new Date().toISOString();

    // Guardar encriptado
    const encryptedData = this.encrypt(JSON.stringify(secrets));
    writeFileSync(this.secretsFile, encryptedData);

    // Eliminar archivo plano si existe (seguridad)
    if (existsSync(this.plaintextFile)) {
      const fs = await import('fs');
      fs.unlinkSync(this.plaintextFile);
      logger.info('🗑️ Archivo de secretos plano eliminado por seguridad');
    }
  }

  /**
   * Encripta datos usando AES-256-GCM con implementación segura
   */
  encrypt(text) {
    // Generar IV aleatorio para cada encriptación
    const iv = crypto.randomBytes(IV_LENGTH);

    // Convertir clave hex a Buffer si es necesario
    const keyBuffer =
      typeof this.encryptionKey === 'string'
        ? Buffer.from(this.encryptionKey, 'hex')
        : this.encryptionKey;

    // Crear cipher con IV explícito
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

    // Encriptar los datos
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Obtener el authentication tag
    const tag = cipher.getAuthTag();

    // Retornar datos encriptados con IV y tag
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      tag: tag.toString('hex'),
      algorithm: ALGORITHM,
      keyLength: KEY_LENGTH,
    });
  }

  /**
   * Desencripta datos usando AES-256-GCM con implementación segura
   */
  decrypt(encryptedData) {
    const data = JSON.parse(encryptedData);

    // Validar que todos los campos requeridos estén presentes
    if (!data.iv || !data.encrypted || !data.tag) {
      throw new Error(
        'Datos de encriptación inválidos: faltan campos requeridos',
      );
    }

    // Convertir IV y tag de hex a Buffer
    const iv = Buffer.from(data.iv, 'hex');
    const tag = Buffer.from(data.tag, 'hex');

    // Convertir clave hex a Buffer si es necesario
    const keyBuffer =
      typeof this.encryptionKey === 'string'
        ? Buffer.from(this.encryptionKey, 'hex')
        : this.encryptionKey;

    // Crear decipher con IV explícito
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);

    // Establecer el authentication tag ANTES de desencriptar
    decipher.setAuthTag(tag);

    // Desencriptar los datos
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');

    try {
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      // Si la autenticación falla, lanzar error específico
      throw new Error(
        'Fallo de autenticación: los datos pueden haber sido manipulados o la clave es incorrecta',
      );
    }
  }

  /**
   * Obtiene estadísticas del secret manager
   */
  getStats() {
    return {
      provider: this.provider,
      cache_size: this.cache.size,
      cache_ttl: this.cacheTTL,
      secrets_file_exists: existsSync(this.secretsFile),
      plaintext_file_exists: existsSync(this.plaintextFile),
    };
  }
}

// Instancia global del SecretManager
let globalSecretManager = null;

/**
 * Obtiene la instancia global del SecretManager
 */
export const getSecretManager = (options = {}) => {
  if (!globalSecretManager) {
    globalSecretManager = new SecretManager(options);
  }
  return globalSecretManager;
};

/**
 * Función helper para obtener secretos de manera segura
 */
export const getSecret = async (key, options = {}) => {
  const manager = getSecretManager();
  return manager.getSecret(key, options);
};

/**
 * Función helper para establecer secretos
 */
export const setSecret = async (key, value) => {
  const manager = getSecretManager();
  return manager.setSecret(key, value);
};

/**
 * Función helper para rotar secretos
 */
export const rotateSecret = async (key, generator) => {
  const manager = getSecretManager();
  return manager.rotateSecret(key, generator);
};
