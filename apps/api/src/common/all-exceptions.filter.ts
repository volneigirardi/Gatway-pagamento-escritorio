import {
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { getRequestContext } from "@saas/observability";

interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId: string | undefined;
  correlationId: string | undefined;
}

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<unknown>();
    const request = ctx.getRequest<{ url: string }>();
    const context = getRequestContext();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail =
      exception instanceof HttpException
        ? ((exception.getResponse() as { message?: string }).message ??
          exception.message)
        : "Internal server error";
    const problem: ProblemDetail = {
      type: "about:blank",
      title: HttpStatus[status] ?? "Error",
      status,
      detail: typeof detail === "string" ? detail : JSON.stringify(detail),
      instance: request.url,
      requestId: context?.requestId,
      correlationId: context?.correlationId,
    };
    if (status >= 500)
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    this.adapterHost.httpAdapter.reply(response, problem, status);
  }
}
