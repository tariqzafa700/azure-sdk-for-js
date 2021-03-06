// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  createPipelineFromOptions,
  InternalPipelineOptions,
  isTokenCredential,
  bearerTokenAuthenticationPolicy,
  operationOptionsToRequestOptionsBase,
  OperationOptions
} from "@azure/core-http";
import { TokenCredential } from "@azure/identity";
import { KeyCredential } from "@azure/core-auth";
import {
  SDK_VERSION,
  DEFAULT_COGNITIVE_SCOPE,
  FormRecognizerLoggingAllowedHeaderNames,
  FormRecognizerLoggingAllowedQueryParameters
} from "./constants";
import { logger } from "./logger";
import { createSpan } from "./tracing";
import {
  FormContentType,
  FormRecognizerClientOptions,
  FormRecognizerOperationOptions,
  toRequestBody,
  getContentType
} from "./common";
import { CanonicalCode } from "@opentelemetry/api";

import { GeneratedClient } from "./generated/generatedClient";
import {
  GeneratedClientAnalyzeLayoutAsyncResponse as AnalyzeLayoutAsyncResponseModel,
  SourcePath,
  OperationStatus
} from "./generated/models";
import { PollOperationState, PollerLike } from "@azure/core-lro";
import {
  RecognizeContentPollerClient,
  BeginRecognizeContentPoller
} from "./lro/analyze/contentPoller";
import {
  RecognizeFormsOperationState,
  FormRecognitionPoller
} from "./lro/analyze/recognitionPoller";
import { FormRecognizerRequestBody, RecognizedFormArray, FormPageArray } from "./models";
import { RecognizeContentResultResponse } from "./internalModels";
import { toRecognizeContentResultResponse } from "./transforms";
import { createFormRecognizerAzureKeyCredentialPolicy } from "./azureKeyCredentialPolicy";

/**
 * Options for content/layout recognition.
 */
export type RecognizeContentOptions = FormRecognizerOperationOptions;

/**
 * The state of a recognize content operation
 */
export type RecognizeContentOperationState = PollOperationState<FormPageArray> & {
  /**
   * A string representing the current status of the operation.
   */
  status: OperationStatus;
};

/**
 * Options for the start content/layout recognition operation
 */
export type BeginRecognizeContentOptions = RecognizeContentOptions & {
  /**
   * Delay to wait until next poll, in milliseconds
   */
  updateIntervalInMs?: number;
  /**
   * Callback to progress events triggered in the content recognition Long-Running-Operation (LRO)
   */
  onProgress?: (state: RecognizeContentOperationState) => void;
  /**
   * A serialized poller which can be used to resume an existing paused Long-Running-Operation.
   */
  resumeFrom?: string;
  /**
   * Content type of the input. Supported types are "application/pdf", "image/jpeg", "image/png", and "image/tiff".
   */
  contentType?: FormContentType;
};

/**
 * The Long-Running-Operation (LRO) poller that allows you to wait until form content is recognized.
 */
export type ContentPollerLike = PollerLike<PollOperationState<FormPageArray>, FormPageArray>;

/**
 * Options for retrieving recognized content data
 */
type GetRecognizedContentResultOptions = FormRecognizerOperationOptions;

/**
 * Options for recognition of forms
 */
export type RecognizeFormsOptions = FormRecognizerOperationOptions & {
  /**
   * Specifies whether to include text lines and element references in the result
   */
  includeFieldElements?: boolean;
};

/**
 * Options for starting the analyze form operation
 */
export type BeginRecognizeFormsOptions = RecognizeFormsOptions & {
  /**
   * Delay to wait until next poll, in milliseconds
   */
  updateIntervalInMs?: number;
  /**
   * Callback to progress events triggered in the Recognize Form Long-Running-Operation (LRO)
   */
  onProgress?: (state: RecognizeFormsOperationState) => void;
  /**
   * A serialized poller which can be used to resume an existing paused Long-Running-Operation.
   */
  resumeFrom?: string;
  /**
   * Content type of the input. Supported types are "application/pdf", "image/jpeg", "image/png", and "image/tiff".
   */
  contentType?: FormContentType;
};

/**
 * Result type of the Recognize Form Long-Running-Operation (LRO)
 */
export type FormPollerLike = PollerLike<RecognizeFormsOperationState, RecognizedFormArray>;

/**
 * Options for starting the receipt recognition operation
 */
export interface BeginRecognizeReceiptsOptions extends BeginRecognizeFormsOptions {
  /**
   * Locale of the document.
   *
   * Supported locales include: en-AU, en-CA, en-GB, en-IN, en-US (default if none provided).
   */
  locale?: string;
}

/**
 * Options for starting the Business Card recognition operation
 */
export interface BeginRecognizeBusinessCardsOptions extends BeginRecognizeFormsOptions {
  /**
   * Locale of the document.
   *
   * Supported locales include: en-AU, en-CA, en-GB, en-IN, en-US (default if none provided).
   */
  locale?: string;
}

/**
 * Client class for interacting with the Azure Form Recognizer service.
 */
export class FormRecognizerClient {
  /**
   * URL to an Azure Form Recognizer service endpoint
   */
  public readonly endpointUrl: string;

  /**
   * @internal
   * @ignore
   * A reference to the auto-generated FormRecognizer HTTP client.
   */
  private readonly client: GeneratedClient;

  /**
   * Creates an instance of FormRecognizerClient.
   *
   * Example usage:
   * ```ts
   * import { FormRecognizerClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
   *
   * const client = new FormRecognizerClient(
   *    "<service endpoint>",
   *    new AzureKeyCredential("<api key>")
   * );
   * ```
   *
   * @param {string} endpointUrl Url to an Azure Form Recognizer service endpoint
   * @param {TokenCredential | KeyCredential} credential Used to authenticate requests to the service.
   * @param {FormRecognizerClientOptions} [options] Used to configure the Form Recognizer client.
   */
  constructor(
    endpointUrl: string,
    credential: TokenCredential | KeyCredential,
    options: FormRecognizerClientOptions = {}
  ) {
    this.endpointUrl = endpointUrl;
    const { ...pipelineOptions } = options;

    const libInfo = `azsdk-js-ai-formrecognizer/${SDK_VERSION}`;
    if (!pipelineOptions.userAgentOptions) {
      pipelineOptions.userAgentOptions = {};
    }
    if (pipelineOptions.userAgentOptions.userAgentPrefix) {
      pipelineOptions.userAgentOptions.userAgentPrefix = `${pipelineOptions.userAgentOptions.userAgentPrefix} ${libInfo}`;
    } else {
      pipelineOptions.userAgentOptions.userAgentPrefix = libInfo;
    }

    const authPolicy = isTokenCredential(credential)
      ? bearerTokenAuthenticationPolicy(credential, DEFAULT_COGNITIVE_SCOPE)
      : createFormRecognizerAzureKeyCredentialPolicy(credential);

    const internalPipelineOptions: InternalPipelineOptions = {
      ...pipelineOptions,
      ...{
        loggingOptions: {
          logger: logger.info,
          allowedHeaderNames: FormRecognizerLoggingAllowedHeaderNames,
          allowedQueryParameters: FormRecognizerLoggingAllowedQueryParameters
        }
      }
    };

    const pipeline = createPipelineFromOptions(internalPipelineOptions, authPolicy);

    this.client = new GeneratedClient(this.endpointUrl, pipeline);
  }

  /**
   * Recognizes content, including text and table structure from a form document.
   *
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the operation is completed.
   * Note that the onProgress callback will not be invoked if the operation completes in the first
   * request, and attempting to cancel a completed copy will result in an error being thrown.
   *
   * Example usage:
   * ```ts
   * const path = "./Invoice_7.pdf";
   * const readStream = fs.createReadStream(path);
   *
   * const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
   * const poller = await client.beginRecognizeContent(readStream, "application/pdf", {
   *   onProgress: (state) => { console.log(`status: ${state.status}`); }
   * });
   *
   * const pages = await poller.pollUntilDone();
   * ```
   * @summary Recognizes content/layout information from a given document
   * @param {FormRecognizerRequestBody} form Input document
   * @param {BeginRecognizeContentOptions} [options] Options to start content recognition operation
   */
  public async beginRecognizeContent(
    form: FormRecognizerRequestBody,
    options: BeginRecognizeContentOptions = {}
  ): Promise<ContentPollerLike> {
    const client: RecognizeContentPollerClient = {
      beginRecognize: (...args) => recognizeLayoutInternal(this.client, ...args),
      getRecognizeResult: (...args) => this.getRecognizedContent(...args)
    };

    const poller = new BeginRecognizeContentPoller({
      client,
      source: form,
      ...options
    });

    await poller.poll();
    return poller;
  }

  /**
   * Recognizes content, including text and table structure from a url to a form document.
   *
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the operation is completed.
   * Note that the onProgress callback will not be invoked if the operation completes in the first
   * request, and attempting to cancel a completed copy will result in an error being thrown.
   *
   * Example usage:
   * ```ts
   * const url = "<form document url>";
   *
   * const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
   * const poller = await client.beginRecognizeContentFromUrl(url, {
   *   onProgress: (state) => { console.log(`status: ${state.status}`); }
   * });
   *
   * const pages = await poller.pollUntilDone();
   * ```
   *
   * @summary Recognizes content/layout information from a url to a form document
   * @param formUrl Url to a document that is accessible from the service. Must be a valid, encoded URL to a document of a supported content type.
   * @param options Options for the content recognition operation
   */
  public async beginRecognizeContentFromUrl(
    formUrl: string,
    options: BeginRecognizeContentOptions = {}
  ): Promise<ContentPollerLike> {
    const client: RecognizeContentPollerClient = {
      beginRecognize: (...args) => recognizeLayoutInternal(this.client, ...args),
      getRecognizeResult: (...args) => this.getRecognizedContent(...args)
    };

    if (options.contentType) {
      logger.warning("Ignoring 'contentType' parameter passed to URL-based method.");
    }

    const poller = new BeginRecognizeContentPoller({
      client,
      source: formUrl,
      ...options,
      contentType: undefined
    });

    await poller.poll();
    return poller;
  }

  /**
   * Retrieves result of content recognition operation.
   * @private
   */
  private async getRecognizedContent(
    resultId: string,
    options?: GetRecognizedContentResultOptions
  ): Promise<RecognizeContentResultResponse> {
    const realOptions = options || {};
    const { span, updatedOptions: finalOptions } = createSpan(
      "FormRecognizerClient-getRecognizedLayoutResult",
      realOptions
    );

    try {
      const requestOptions = operationOptionsToRequestOptionsBase(finalOptions);
      const analyzeResult = await this.client.getAnalyzeLayoutResult(resultId, requestOptions);
      return toRecognizeContentResultResponse(analyzeResult);
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Recognizes forms from a given document using a custom form model from training.
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the operation is completed.
   * Note that the onProgress callback will not be invoked if the operation completes in the first
   * request, and attempting to cancel a completed copy will result in an error being thrown.
   *
   * Example usage:
   * ```ts
   * const path = "./Invoice_6.pdf";
   * const readStream = fs.createReadStream(path);
   *
   * const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
   * const poller = await client.beginRecognizeCustomForms(modelId, readStream, "application/pdf", {
   *   onProgress: (state) => { console.log(`status: ${state.status}`); }
   * });
   * const forms = await poller.pollUntilDone();
   * ```
   * @summary Recognizes form information from a given document using a custom form model.
   * @param {string} modelId Id of the custom form model to use
   * @param {FormRecognizerRequestBody} form Input form document
   * @param {BeginRecognizeFormsOptions} [options] Options to start the form recognition operation
   */
  public async beginRecognizeCustomForms(
    modelId: string,
    form: FormRecognizerRequestBody,
    options: BeginRecognizeFormsOptions = {}
  ): Promise<FormPollerLike> {
    if (!modelId) {
      throw new RangeError("Invalid model id");
    }

    const { span } = makeSpanner("FormRecognizerClient-beginRecognizeCustomForms", {
      ...options,
      includeTextDetails: options.includeFieldElements
    });

    const poller = new FormRecognitionPoller({
      modelId,
      createOperation: span("customFormsInternal", async (finalOptions) => {
        const requestBody = await toRequestBody(form);
        const contentType = finalOptions.contentType ?? (await getContentType(requestBody));
        return processOperationLocation(
          await this.client.analyzeWithCustomModel(
            modelId,
            contentType!,
            requestBody as Blob | ArrayBuffer | ArrayBufferView,
            operationOptionsToRequestOptionsBase(finalOptions)
          )
        );
      }),
      getResult: span("getCustomForms", async (finalOptions, resultId, modelId) =>
        // using the modelId from the parameter here is important, as we could be restoring from
        // a suspended LRO
        this.client.getAnalyzeFormResult(
          // Must be defined to have reached this point, but only for custom form recognition
          modelId!,
          resultId,
          operationOptionsToRequestOptionsBase(finalOptions)
        )
      ),
      ...options
    });

    await poller.poll();
    return poller;
  }

  /**
   * Recognizes forms from a URL to a document using a custom form model from training.
   *
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the operation is completed.
   *
   * Note that the onProgress callback will not be invoked if the operation completes in the first
   * request, and attempting to cancel a completed copy will result in an error being thrown.
   *
   * Example usage:
   * ```ts
   * const url = "<form document url>";
   *
   * const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
   * const poller = await client.beginRecognizeCustomFormsFromUrl(modelId, url, {
   *   onProgress: (state) => { console.log(`status: ${state.status}`); }
   * });
   * const forms = await poller.pollUntilDone();
   * ```
   *
   * @summary Recognizes form information from a url to a document using a custom form model.
   * @param modelId Id of the custom form model to use
   * @param formUrl Url to a document that is accessible from the service. Must be a valid, encoded URL to a document of a supported content type.
   * @param options Options for the recognition operation
   */
  public async beginRecognizeCustomFormsFromUrl(
    modelId: string,
    formUrl: string,
    options: BeginRecognizeFormsOptions = {}
  ): Promise<FormPollerLike> {
    if (!modelId) {
      throw new RangeError("Invalid model id");
    }

    const { span } = makeSpanner("FormRecognizerClient-beginRecognizeCustomForms", {
      ...options,
      includeTextDetails: options.includeFieldElements
    });

    const poller = new FormRecognitionPoller({
      modelId,
      createOperation: span("customFormsInternal", async (finalOptions) => {
        return processOperationLocation(
          await this.client.analyzeWithCustomModel(modelId, "application/json", {
            fileStream: {
              source: formUrl
            },
            ...operationOptionsToRequestOptionsBase(finalOptions)
          })
        );
      }),
      getResult: span("getCustomForms", async (finalOptions, resultId, modelId) =>
        // using the modelId from the parameter here is important, as we could be restoring from
        // a suspended LRO
        this.client.getAnalyzeFormResult(
          // Must be defined to have reached this point, but only for custom form recognition
          modelId!,
          resultId,
          operationOptionsToRequestOptionsBase(finalOptions)
        )
      ),
      ...options
    });

    await poller.poll();
    return poller;
  }

  /**
   * Recognizes data from business cards using pre-built business card model, enabling you to extract structured data
   * from business cards such as name, job title, phone numbers, etc.
   *
   * For a list of fields that are contained in the response, please refer to the documentation at the
   * following link: https://aka.ms/azsdk/formrecognizer/businesscardfields
   *
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the operation is completed.
   *
   * Note that the onProgress callback will not be invoked if the operation completes in the first
   * request, and attempting to cancel a completed copy will result in an error being thrown.
   *
   * Example usage:
   * ```ts
   * const path = "./business-card-english.png";
   * const readStream = fs.createReadStream(path);
   *
   * const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
   * const poller = await client.beginRecognizeBusinessCards(readStream, {
   *   contentType: "image/png",
   *   onProgress: (state) => { console.log(`status: ${state.status}`); }
   * });
   *
   * const [businessCard] = await poller.pollUntilDone();
   * ```
   *
   * @summary Recognizes business card information from a given document
   * @param businessCard Input document
   * @param options Options for the recognition operation
   */
  public async beginRecognizeBusinessCards(
    businessCard: FormRecognizerRequestBody,
    options: BeginRecognizeBusinessCardsOptions = { includeFieldElements: false }
  ): Promise<FormPollerLike> {
    const { span } = makeSpanner("FormRecognizerClient-beginRecognizeBusinessCards", {
      ...options,
      includeTextDetails: options.includeFieldElements
    });

    const poller = new FormRecognitionPoller({
      expectedDocType: "prebuilt:businessCard",
      createOperation: span("businessCardsInternal", async (finalOptions) => {
        const requestBody = await toRequestBody(businessCard);
        const contentType = finalOptions.contentType ?? (await getContentType(requestBody));
        return processOperationLocation(
          await this.client.analyzeBusinessCardAsync(
            contentType!,
            requestBody as Blob | ArrayBuffer | ArrayBufferView,
            operationOptionsToRequestOptionsBase(finalOptions)
          )
        );
      }),
      getResult: span("getBusinessCards", async (finalOptions, resultId) =>
        this.client.getAnalyzeBusinessCardResult(
          resultId,
          operationOptionsToRequestOptionsBase(finalOptions)
        )
      ),
      ...options
    });

    await poller.poll();
    return poller;
  }

  /**
   * Recognizes business card information from a url using pre-built business card model, enabling you to extract structured data
   * from business cards such as name, job title, phone numbers, etc.
   *
   * For a list of fields that are contained in the response, please refer to the documentation at the following link: https://aka.ms/azsdk/formrecognizer/businesscardfields
   *
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the operation is completed.
   *
   * Note that the onProgress callback will not be invoked if the operation completes in the first
   * request, and attempting to cancel a completed copy will result in an error being thrown.
   *
   * Example usage:
   * ```ts
   * const url = "<url to the business card document>";
   * const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
   * const poller = await client.beginRecognizeBusinessCardsFromUrl(url, {
   *   includeFieldElements: true,
   *   onProgress: (state) => {
   *     console.log(`analyzing status: ${state.status}`);
   *   }
   * });
   * const [businessCard] = await poller.pollUntilDone();
   * ```
   *
   * @summary Recognizes business card information from a given accessible url to a document
   * @param businessCardUrl Url to a business card document that is accessible from the service. Must be a valid, encoded URL to a document of a supported content type.
   * @param options Options for the recognition operation
   */
  public async beginRecognizeBusinessCardsFromUrl(
    businessCardUrl: string,
    options: BeginRecognizeBusinessCardsOptions = { includeFieldElements: false }
  ): Promise<FormPollerLike> {
    if (options.contentType) {
      logger.warning("Ignoring 'contentType' parameter passed to URL-based method.");
    }

    const { span } = makeSpanner("FormRecognizerClient-beginRecognizeBusinessCardsFromUrl", {
      ...options,
      contentType: undefined,
      includeTextDetails: options.includeFieldElements
    });

    const poller = new FormRecognitionPoller({
      expectedDocType: "prebuilt:businessCard",
      createOperation: span("businessCardsInternal", async (finalOptions) => {
        return processOperationLocation(
          await this.client.analyzeBusinessCardAsync("application/json", {
            fileStream: {
              source: businessCardUrl
            },
            ...operationOptionsToRequestOptionsBase(finalOptions)
          })
        );
      }),
      getResult: span("getBusinessCards", async (finalOptions, resultId) =>
        this.client.getAnalyzeBusinessCardResult(
          resultId,
          operationOptionsToRequestOptionsBase(finalOptions)
        )
      ),
      ...options
    });

    await poller.poll();
    return poller;
  }

  /**
   * Recognizes data from receipts using pre-built receipt model, enabling you to extract structure data
   * from receipts such as merchant name, merchant phone number, transaction date, and more.
   *
   * For a list of fields that are contained in the response, please refer to the documentation at the following link: https://aka.ms/azsdk/formrecognizer/receiptfields
   *
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the operation is completed.
   *
   * Note that the onProgress callback will not be invoked if the operation completes in the first
   * request, and attempting to cancel a completed copy will result in an error being thrown.
   *
   * Example usage:
   * ```ts
   * const path = "./contoso-allinone.jpg";
   * const readStream = fs.createReadStream(path);
   *
   * const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
   * const poller = await client.beginRecognizeReceipts(readStream, {
   *   contentType: "image/jpeg",
   *   onProgress: (state) => { console.log(`status: ${state.status}`); }
   * });
   *
   * const [receipt] = await poller.pollUntilDone();
   * ```
   *
   * @summary Recognizes receipt information from a given document
   * @param {FormRecognizerRequestBody} receipt Input document
   * @param {FormContentType} contentType Content type of the input. Supported types are "application/pdf", "image/jpeg", "image/png", and "image/tiff";
   * @param {BeginRecognizeFormsOptions} [options] Options to start the receipt recognition operation
   */
  public async beginRecognizeReceipts(
    receipt: FormRecognizerRequestBody,
    options: BeginRecognizeReceiptsOptions = {}
  ): Promise<FormPollerLike> {
    const { span } = makeSpanner("FormRecognizerClient-beginRecognizeReceipts", {
      ...options,
      includeTextDetails: options.includeFieldElements
    });

    const poller = new FormRecognitionPoller({
      expectedDocType: "prebuilt:receipt",
      createOperation: span("receiptsInternal", async (finalOptions) => {
        const requestBody = await toRequestBody(receipt);
        const contentType = finalOptions.contentType ?? (await getContentType(requestBody));
        return processOperationLocation(
          await this.client.analyzeReceiptAsync(
            contentType!,
            requestBody as Blob | ArrayBuffer | ArrayBufferView,
            operationOptionsToRequestOptionsBase(finalOptions)
          )
        );
      }),
      getResult: span("getReceipts", async (finalOptions, resultId) =>
        this.client.getAnalyzeReceiptResult(
          resultId,
          operationOptionsToRequestOptionsBase(finalOptions)
        )
      ),
      ...options
    });

    await poller.poll();
    return poller;
  }

  /**
   * Recognizes receipt information from a url using pre-built receipt model, enabling you to extract structure data
   * from receipts such as merchant name, merchant phone number, transaction date, and more.
   *
   * For a list of fields that are contained in the response, please refer to the documentation at the
   * following link: https://aka.ms/azsdk/formrecognizer/receiptfields
   *
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the operation is completed.
   *
   * Note that the onProgress callback will not be invoked if the operation completes in the first
   * request, and attempting to cancel a completed copy will result in an error being thrown.
   *
   * Example usage:
   * ```ts
   * const url = "<url to the receipt document>";
   * const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
   * const poller = await client.beginRecognizeReceiptsFromUrl(url, {
   *   includeFieldElements: true,
   *   onProgress: (state) => {
   *     console.log(`analyzing status: ${state.status}`);
   *   }
   * });
   * const [receipt] = await poller.pollUntilDone();
   * ```
   *
   * @summary Recognizes receipt information from a given accessible url to a document
   * @param receiptUrl Url to a receipt document that is accessible from the service. Must be a valid, encoded URL to a document of a supported content type.
   * @param options Options for the recognition operation
   */
  public async beginRecognizeReceiptsFromUrl(
    receiptUrl: string,
    options: BeginRecognizeReceiptsOptions = {}
  ): Promise<FormPollerLike> {
    if (options.contentType) {
      logger.warning("Ignoring 'contentType' parameter passed to URL-based method.");
    }

    const { span } = makeSpanner("FormRecognizerClient-beginRecognizeReceiptsFromUrl", {
      ...options,
      contentType: undefined,
      includeTextDetails: options.includeFieldElements
    });

    const poller = new FormRecognitionPoller({
      expectedDocType: "prebuilt:receipt",
      createOperation: span("receiptsInternal", async (finalOptions) => {
        return processOperationLocation(
          await this.client.analyzeReceiptAsync("application/json", {
            fileStream: {
              source: receiptUrl
            },
            ...operationOptionsToRequestOptionsBase(finalOptions)
          })
        );
      }),
      getResult: span("getReceipts", async (finalOptions, resultId) =>
        this.client.getAnalyzeReceiptResult(
          resultId,
          operationOptionsToRequestOptionsBase(finalOptions)
        )
      ),
      ...options
    });

    await poller.poll();
    return poller;
  }
}

/**
 * An operation that can be queried.
 *
 * @internal
 */
interface RemoteOperation {
  operationLocation?: string;
}

/**
 * Validates a remote operation's location is defined and extracts the
 * result ID from it.
 *
 * @param remoteOperation the operation to process
 * @returns the remote operation ID
 *
 * @internal
 */
function processOperationLocation({ operationLocation }: RemoteOperation): string {
  if (!operationLocation) {
    throw new Error("The service did not respond with an 'operationLocation' to retrieve results.");
  } else {
    const lastSlashIndex = operationLocation.lastIndexOf("/");
    return operationLocation.substring(lastSlashIndex + 1);
  }
}

/**
 * Type of the auto-spanner returned by `makeSpanner`
 *
 * @internal
 */
interface Spanner<Options> {
  /**
   * Invokes a handler in the context of a span. When the handler is called,
   * an argument will be inserted at the beginning of the arguments list
   * containing the `options` that may have been updated by the tracer.
   *
   * @param name the name of this span, which will appear in the trace.
   * @param handler the handler to run. Its first parameter will have the
   *   type of `options` that were passed to `makeSpanner`
   *
   * @returns a function that will wrap a call to the `handler` in tracing code, forwarding its parameters
   */
  span<Args extends unknown[], Result>(
    name: string,
    handler: (updatedOptions: Options, ...rest: Args) => Result
  ): (...args: Args) => Result;
}

/**
 * Helper function to create spans for internal polling handlers
 *
 * The argument is a handler function that will be wrapped in a tracing
 * span, where tracing-updated options will be inserted as its first parameter.
 *
 * @example
 * ```typescript
 * const spanned = makeSpanner("FormRecognizerClient-beginRecognizeReceipts", {
 *   ...options,
 *   // Override any options you need here
 * });
 *
 * const autoSpannedFunction = spanner("autoSpannedFunction", (updatedOptions) => {
 *  // ...
 * });
 * ```
 *
 * @internal
 */
function makeSpanner<Options extends OperationOptions>(
  prefix: string,
  options: Options
): Spanner<Options> {
  return {
    span: (name, handler) => (...args) => {
      const { span, updatedOptions } = createSpan(`${prefix}-${name}`, options);

      try {
        return handler(updatedOptions, ...args);
      } catch (e) {
        span.setStatus({
          code: CanonicalCode.UNKNOWN,
          message: e.message
        });
        throw e;
      } finally {
        span.end();
      }
    }
  };
}

/**
 * The worker function of layout analysis.
 *
 * @internal
 */
async function recognizeLayoutInternal(
  // eslint-disable-next-line @azure/azure-sdk/ts-use-interface-parameters
  client: GeneratedClient,
  body: FormRecognizerRequestBody | string,
  contentType?: FormContentType,
  options?: RecognizeContentOptions,
  _modelId?: string
): Promise<AnalyzeLayoutAsyncResponseModel> {
  const realOptions = options || {};
  const { span, updatedOptions: finalOptions } = createSpan("analyzeLayoutInternal", realOptions);
  const requestBody = await toRequestBody(body);
  const requestContentType = contentType ? contentType : await getContentType(requestBody);

  try {
    if (requestContentType) {
      return await client.analyzeLayoutAsync(
        requestContentType,
        requestBody as Blob | ArrayBuffer | ArrayBufferView,
        operationOptionsToRequestOptionsBase(finalOptions)
      );
    }
    return await client.analyzeLayoutAsync("application/json", {
      fileStream: requestBody as SourcePath,
      ...operationOptionsToRequestOptionsBase(finalOptions)
    });
  } catch (e) {
    span.setStatus({
      code: CanonicalCode.UNKNOWN,
      message: e.message
    });
    throw e;
  } finally {
    span.end();
  }
}
