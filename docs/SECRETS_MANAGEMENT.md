# 🔐 Gestión de Secretos - frys Production

## Resumen

frys implementa un sistema avanzado de gestión de secretos que proporciona múltiples capas de seguridad y flexibilidad para manejar credenciales sensibles, API keys y otros secretos.

## Arquitectura

### Providers Soportados

1. **Encrypted File** (Desarrollo)
   - Archivos encriptados localmente con AES-256-GCM
   - Ideal para desarrollo y testing
   - Fácil de usar, seguro para desarrollo

2. **AWS Secrets Manager** (Producción)
   - Servicio gestionado de AWS
   - Alta disponibilidad y escalabilidad
   - Integración perfecta con otros servicios AWS

3. **HashiCorp Vault** (Producción)
   - Solución enterprise de gestión de secretos
   - Control de acceso granular
   - Auditing completo

4. **Azure Key Vault** (Producción)
   - Servicio gestionado de Microsoft Azure
   - Integración con Azure Active Directory
   - Backup automático

## Configuración

### Variables de Entorno

```bash
# Provider a usar
SECRETS_PROVIDER=encrypted-file  # o aws-secrets-manager, hashicorp-vault, azure-key-vault

# AWS Secrets Manager
AWS_REGION=us-east-1

# HashiCorp Vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=hvs.your-token-here

# Azure Key Vault
AZURE_CLIENT_ID=your-client-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_KEYVAULT_NAME=your-keyvault-name
```

### Inicialización

Para desarrollo, inicializa los secretos básicos:

```bash
npm run secrets:init
```

Esto creará:

- JWT secret aleatorio
- Contraseñas de base de datos aleatorias
- Contraseñas de cache aleatorias

## Uso

### Línea de Comandos

```bash
# Listar secretos
npm run secrets:list

# Obtener un secreto
npm run secrets get jwt_secret

# Establecer un secreto
npm run secrets set openai_api_key sk-your-api-key-here

# Rotar un secreto
npm run secrets rotate db_password

# Ver estadísticas
npm run secrets:stats
```

### Programático

```javascript
import {
  getSecret,
  setSecret,
  rotateSecret,
} from './src/utils/secret-manager.js';

// Obtener un secreto
const apiKey = await getSecret('openai_api_key');

// Establecer un secreto
await setSecret('new_secret', 'secret-value');

// Rotar un secreto
const newPassword = await rotateSecret('db_password');
```

### Configuración Automática

La configuración se carga automáticamente con secretos:

```javascript
import { loadConfig } from './src/utils/config.js';

// Carga configuración completa con secretos
const config = await loadConfig();

// Los secretos están disponibles automáticamente
console.log(config.ai.providers.openai.apiKey); // ✅ Seguro
console.log(config.database.password); // ✅ Seguro
```

## Secretos Gestionados

### Autenticación

- `jwt_secret`: Secreto para tokens JWT

### Base de Datos

- `db_password`: Contraseña de base de datos
- `cache_password`: Contraseña de Redis/cache

### APIs de IA

- `openai_api_key`: API key de OpenAI
- `claude_api_key`: API key de Anthropic Claude
- `gemini_api_key`: API key de Google Gemini
- `deepseek_api_key`: API key de DeepSeek
- `alibaba_api_key`: API key de Alibaba
- `cognee_api_key`: API key de Cognee

### Notificaciones

- `email_password`: Contraseña SMTP
- `slack_webhook_url`: Webhook URL de Slack

## Seguridad

### Principios

1. **Principio de Menor Privilegio**: Los secretos solo se cargan cuando son necesarios
2. **Encriptación en Reposo**: Todos los secretos se almacenan encriptados
3. **Auditing**: Todas las operaciones con secretos se registran
4. **Rotación**: Los secretos pueden rotarse sin downtime
5. **Fail-Safe**: Si un secreto no está disponible, se usa un valor por defecto seguro

### Mejores Prácticas

#### Desarrollo

```bash
# Nunca commits archivos con secretos
echo ".secrets.enc" >> .gitignore
echo ".secrets.json" >> .gitignore

# Usa valores por defecto seguros
npm run secrets:init
```

#### Producción

```bash
# Configura el provider apropiado
export SECRETS_PROVIDER=aws-secrets-manager

# Rota secretos regularmente
npm run secrets rotate jwt_secret
npm run secrets rotate db_password

# Monitorea el acceso a secretos
npm run secrets:stats
```

#### CI/CD

```yaml
# En tus pipelines
- name: Configure Secrets
  run: |
    echo "SECRETS_PROVIDER=aws-secrets-manager" >> $GITHUB_ENV
    echo "AWS_REGION=${{ secrets.AWS_REGION }}" >> $GITHUB_ENV

- name: Deploy
  run: npm run deploy
```

## Migración

### Desde Variables de Entorno

Si actualmente usas variables de entorno directas:

```bash
# Migra secretos existentes
npm run secrets set jwt_secret $JWT_SECRET
npm run secrets set db_password $DB_PASSWORD
npm run secrets set openai_api_key $OPENAI_API_KEY

# Actualiza tu código para usar loadConfig()
# Los archivos de configuración ya no contienen secretos
```

### Backup y Restore

```bash
# Crear backup
npm run secrets backup backup-2024.enc

# Restaurar desde backup
npm run secrets restore backup-2024.enc
```

## Troubleshooting

### Problemas Comunes

#### "Secret not found"

```bash
# Verifica que el secreto existe
npm run secrets:list

# Inicializa secretos por defecto
npm run secrets:init
```

#### "Encryption key not found"

```bash
# Para desarrollo, crea .secrets.json
npm run secrets:init

# Para producción, configura el provider correcto
export SECRETS_PROVIDER=aws-secrets-manager
```

#### "Permission denied"

```bash
# Verifica credenciales del provider
aws sts get-caller-identity  # Para AWS
vault status                # Para Vault
az login                    # Para Azure
```

### Logs de Seguridad

Los logs de seguridad se escriben a:

- `logs/security-audit.log`: Operaciones con secretos
- `logs/secret-access.log`: Acceso a secretos

### Monitoreo

```bash
# Ver estadísticas
npm run secrets:stats

# Monitorear en producción
- Número de secretos accedidos
- Tasa de rotación de secretos
- Errores de acceso a secretos
```

## Referencias

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [HashiCorp Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [Azure Key Vault Documentation](https://learn.microsoft.com/en-us/azure/key-vault/)

## Soporte

Para soporte técnico contacta al equipo de seguridad:

- Email: security@frys.io
- Slack: #security-channel
