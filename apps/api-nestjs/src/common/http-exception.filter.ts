import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

interface ErrorResponseBody {
  code: string;
  message_fr: string;
  retryable: boolean;
  field?: string | null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let messageFr = 'Erreur interne du serveur';
    let retryable = true;
    let field: string | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        if (obj.code) {
          code = String(obj.code);
        } else {
          code = this.defaultCodeForStatus(status);
        }

        if (obj.message_fr) {
          messageFr = String(obj.message_fr);
        } else if (Array.isArray(obj.message)) {
          messageFr = 'Données de validation non conformes';
          field = obj.message.join('; ');
        } else if (typeof obj.message === 'string') {
          messageFr = obj.message;
        } else {
          messageFr = this.defaultMessageForStatus(status);
        }

        retryable = typeof obj.retryable === 'boolean' ? obj.retryable : status >= 500;
        if (obj.field !== undefined) {
          field = obj.field;
        }
      } else if (typeof res === 'string') {
        code = this.defaultCodeForStatus(status);
        messageFr = res;
        retryable = status >= 500;
      }
    } else if (exception instanceof Error) {
      messageFr = exception.message || 'Erreur interne du serveur';
    }

    const payload: ErrorResponseBody = {
      code,
      message_fr: messageFr,
      retryable,
      ...(field ? { field } : {}),
    };

    response.status(status).json(payload);
  }

  private defaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'INVALID_INPUT';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }

  private defaultMessageForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Requête invalide';
      case HttpStatus.UNAUTHORIZED:
        return 'Authentification requise';
      case HttpStatus.FORBIDDEN:
        return 'Accès refusé pour ce profil';
      case HttpStatus.NOT_FOUND:
        return 'Ressource introuvable';
      case HttpStatus.CONFLICT:
        return 'Conflit avec l’état actuel de la ressource';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service temporairement indisponible';
      default:
        return 'Erreur interne du serveur';
    }
  }
}
