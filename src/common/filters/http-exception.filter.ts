// src/common/filters/http-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<string>() === 'graphql') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message =
          'message' in exceptionResponse
            ? (exceptionResponse as any).message
            : message;
        errorName =
          'error' in exceptionResponse
            ? (exceptionResponse as any).error
            : undefined;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception
    ) {
      // Safely map common Prisma race-condition errors without leaking SQL/table internals
      const prismaCode = (exception as { code?: string }).code;
      if (prismaCode === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with this unique value already exists';
        errorName = 'Conflict';
      } else if (prismaCode === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Requested record was not found';
        errorName = 'Not Found';
      }
    }

    // Only log full error stack traces for 5xx Internal Server Errors.
    // 4xx errors (404 Not Found, 401 Unauthorized, etc.) are normal client responses and should not dump scary stack traces.
    const method = request?.method || 'UNKNOWN';
    const url = request?.originalUrl || request?.url || '';
    const formattedMsg = Array.isArray(message) ? message.join(', ') : message;

    if (status >= 500) {
      this.logger.error(
        `[${status}] ${method} ${url}: ${formattedMsg}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${status}] ${method} ${url}: ${formattedMsg}`);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      error: errorName,
    });
  }
}
