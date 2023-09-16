/*!
 * @description The types for `httpClient` utility.
 * @author Andrii Lytovchenko <andr.lyt.dev@gmail.com>
 * @license MIT
 */

import * as http from 'http';

export enum Method {
  POST = 'POST',
  PUT = 'PUT',
  GET = 'GET',
  DELETE = 'DELETE',
}

export enum ErrorMessage {
  MIN_RETRY_ATTEMPTS = 'Retry attempts must not be less than 0',
  MIN_INTERVAL = 'Retry interval must not be less than 0',
  INVALID_CONTENT_TYPE = 'Unable to validate: content-type of response is not application/json.',
  UNSUPPORTED_PROTOCOL = 'Unsupported protocol:',
}

export interface Response<T, B extends boolean> {
  status: number;
  contentLength: number;
  ok: boolean;
  headers: http.IncomingHttpHeaders;
  json: B extends true ? T : T | undefined;
  body: string;
}

export interface RetryOptions {
  /**
   * Amount of attempts after failed request.
   */
  attempts: number;
  /**
   * Time in **seconds** to wait before perform new retry.
   * @default 10 seconds
   */
  interval?: number;
  /**
   * Specifies if log should be written, if request has failed.
   */
  logOnRetry?: boolean;
}
