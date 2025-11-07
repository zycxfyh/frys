/**
 * 领域错误类
 * 提供类型化的错误处理
 */

export class DomainError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message, field, value, details = {}) {
    super(message, 'VALIDATION_ERROR', { field, value, ...details });
    this.field = field;
    this.value = value;
  }
}

export class NotFoundError extends DomainError {
  constructor(resource, identifier, details = {}) {
    super(`${resource} not found: ${identifier}`, 'NOT_FOUND', {
      resource,
      identifier,
      ...details,
    });
    this.resource = resource;
    this.identifier = identifier;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized access', details = {}) {
    super(message, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden access', details = {}) {
    super(message, 'FORBIDDEN', details);
  }
}

export class ConflictError extends DomainError {
  constructor(message, resource, details = {}) {
    super(message, 'CONFLICT', { resource, ...details });
    this.resource = resource;
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(rule, details = {}) {
    super(`Business rule violated: ${rule}`, 'BUSINESS_RULE_VIOLATION', {
      rule,
      ...details,
    });
    this.rule = rule;
  }
}

export class ExternalServiceError extends DomainError {
  constructor(service, operation, originalError, details = {}) {
    super(
      `External service error: ${service}.${operation}`,
      'EXTERNAL_SERVICE_ERROR',
      {
        service,
        operation,
        originalError: originalError.message,
        ...details,
      },
    );
    this.service = service;
    this.operation = operation;
    this.originalError = originalError;
  }
}

export class InfrastructureError extends DomainError {
  constructor(component, operation, originalError, details = {}) {
    super(
      `Infrastructure error: ${component}.${operation}`,
      'INFRASTRUCTURE_ERROR',
      {
        component,
        operation,
        originalError: originalError.message,
        ...details,
      },
    );
    this.component = component;
    this.operation = operation;
    this.originalError = originalError;
  }
}
