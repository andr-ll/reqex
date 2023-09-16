/*!
 * @author Andrii Lytovchenko <andr.lyt.dev@gmail.com>
 * @license MIT
 */

// Needed for comments only.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as types from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as http from 'http';
import * as https from 'https';
import nuti from 'nuti';
import { ErrorMessage, Method, Response, RetryOptions } from './types';
import { validate, ValidationResult, ValidationSchema, Values } from 'vator';

const logger = nuti.makeLogger();

const PROTOCOLS: Partial<Record<string, typeof http | typeof https>> = {
  ['http:']: http,
  ['https:']: https,
};

export class Request<
  M extends Method = Method,
  B extends boolean = false,
  S extends ValidationSchema | Values = Values | ValidationSchema,
  T = B extends true ? ValidationResult<S> : unknown,
> extends Promise<Response<T, B>> {
  private _headers: http.IncomingHttpHeaders = {};
  private _body: unknown;
  private _retryAttempts = 0;
  private _retryInterval = 10;
  private _pipeStream: NodeJS.WritableStream | NodeJS.ReadWriteStream;
  private _logOnRetry = true;
  private _schema: S;

  constructor(
    private readonly url: string,
    private readonly method: M,
  ) {
    super(() => {
      return;
    });

    if (this.method !== 'GET') {
      this.body = this.bodySetter.bind(this);
    }
  }

  /*!
   * Public methods
   */

  /**
   * Sets body for the request. Not available with `GET` request.
   * @param body valid value to be sent through http(s)
   * @returns a {@link Request Request} entity or {@link types.Response Response} if await/then used.
   */
  public body: M extends 'GET' ? never : (body: unknown) => Request<M>;

  /**
   * Adds retry logic to the request.
   * @param options retry `attempts`, `interval` (in seconds) and `logOnError` flag ({@link types.RetryOptions RetryOptions})
   * @default { attempts: 0, interval: 10 }
   * @returns a {@link Request Request} entity or {@link types.Response Response} if await/then used.
   * @throws an error if `options.attempts` or `options.interval` are less than 0
   */
  retry(options: RetryOptions) {
    const { attempts, interval, logOnRetry = true } = options;

    if (attempts < 0) throw new Error(ErrorMessage.MIN_RETRY_ATTEMPTS);

    this._retryAttempts = Math.min(attempts, 15);

    if (interval) {
      if (interval < 0) throw new Error(ErrorMessage.MIN_INTERVAL);

      this._retryInterval = Math.min(interval, 60);
    }

    this._logOnRetry = logOnRetry;

    return this;
  }

  /**
   * Adds stream for piping response to.
   * @param stream is a valid {@link NodeJS.WritableStream WritableStream}
   * @returns a {@link Request Request} entity or {@link types.Response Response} if await/then used.
   */
  pipe(stream: NodeJS.WritableStream) {
    this._pipeStream = stream;

    return this;
  }

  /**
   * Sets headers to the request.
   * @default
   * { 'content-type': 'application/json', 'content-length': requestBody.length, }
   * @param headers valid {@link http.IncomingHttpHeaders IncomingHttpHeaders}
   * @returns a {@link Request Request} entity or {@link types.Response Response} if await/then used.
   */
  headers(headers: http.IncomingHttpHeaders) {
    this._headers = headers;
    return this;
  }

  validate<Schema extends S>(schema: Schema) {
    this._schema = schema;
    return this as unknown as Request<M, true, Schema>;
  }

  /*!
   * Private methods
   */

  /**
   * Manages request with retries and rets retry attempts to 0 if
   * pipe stream is present.
   * @returns a {@link types.Response Response} promise
   * @throws an error if request has failed (after all retries if they were added)
   */
  private async manageRequest(): Promise<Response<T, B>> {
    if (this._pipeStream) {
      this._retryAttempts = 0;
    }

    try {
      const result = await this.doRequest();
      return result;
    } catch (error) {
      if (this._retryAttempts <= 0) {
        throw error;
      }

      this.logOnRetry(error);

      this._retryAttempts -= 1;
      await nuti.timeout(this._retryInterval * 1000);

      return this.manageRequest();
    }
  }

  private logOnRetry(error: unknown) {
    if (!this._logOnRetry) return;

    logger.warn(`Request has failed, retry in ${this._retryInterval} sec.`, {
      error,
    });
  }

  /**
   * Creates request and process response data.
   * @returns Response promise
   */
  private async doRequest() {
    return new Promise<Response<T, B>>((resolve, reject) => {
      const { opts, validProtocol, rawReqBody } = this.validateRequestInput();

      const req = validProtocol.request(opts, (res) => {
        let rawData = '';
        const status = res.statusCode as number;
        const isJSON =
          res.headers['content-type']?.match(/application\/json/) != null;

        if (this._pipeStream) {
          res.pipe(this._pipeStream);
        }

        res.on('data', (chunk) => {
          rawData += chunk.toString();
        });

        res.on('end', () => {
          const json =
            isJSON && status !== 204 ? JSON.parse(rawData) : undefined;

          // Should throw if expected JSON response
          this.validateResponse(json, reject);

          resolve({
            status,
            ok: status < 400,
            contentLength: rawData.length,
            headers: res.headers,
            json,
            body: rawData,
          });
        });

        res.on('error', reject);
      });

      req.on('error', reject);
      req.write(rawReqBody);
      req.end();
    });
  }

  /**
   * Validates response with vator.
   * Throws an error if response is invalid.
   */
  private validateResponse(json: unknown, reject: (err: unknown) => void) {
    if (!this._schema) return;

    if (!json) {
      reject(new Error(ErrorMessage.INVALID_CONTENT_TYPE));
    }

    try {
      this._retryAttempts = 0;
      validate(json, this._schema);
    } catch (error) {
      reject(error);
    }
  }

  /**
   * Validates and changes request's input.
   * @returns valid request options, raw request body and valid protocol (http(s))
   */
  private validateRequestInput() {
    const { protocol, hostname, port, pathname, host } = new URL(this.url);
    const validProtocol = PROTOCOLS[protocol];

    if (validProtocol == null) {
      throw new Error(
        `${ErrorMessage.UNSUPPORTED_PROTOCOL} ${protocol.replace(':', '')}`,
      );
    }

    const rawReqBody = this._body ? JSON.stringify(this._body) : '';

    if (this._headers['content-type'] == null) {
      this._headers['content-type'] = 'application/json; charset=UTF-8';
      this._headers['content-length'] = rawReqBody.length.toString();
    }

    return {
      opts: {
        protocol,
        hostname,
        host,
        port,
        path: pathname,
        headers: this._headers,
        method: this.method,
      },
      validProtocol,
      rawReqBody,
    };
  }

  /**
   * A method for initializing 'body' method.
   * Used in the constructor.
   * @param body
   * @returns
   */
  private bodySetter(body: unknown) {
    if (this.method !== 'GET') {
      this._body = body;
    }

    return this;
  }

  /*!
   * Override promise default methods then, catch and finally
   */

  then<TResult1 = Response<T, B>, TResult2 = never>(
    onfulfilled?:
      | ((value: Response<T, B>) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.manageRequest().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<Response<T, B> | TResult> {
    return this.manageRequest().catch(onrejected);
  }

  finally(
    onfinally?: (() => void) | null | undefined,
  ): Promise<Response<T, B>> {
    return this.manageRequest().finally(onfinally);
  }
}
