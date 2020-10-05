/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is
 * regenerated.
 */

import * as coreHttp from "@azure/core-http";
import * as Models from "./models";
import * as Mappers from "./models/mappers";
import * as operations from "./operations";
import { PhoneNumberRestClientContext } from "./phoneNumberRestClientContext";

class PhoneNumberRestClient extends PhoneNumberRestClientContext {
  // Operation groups
  phoneNumberAdministration: operations.PhoneNumberAdministration;

  /**
   * Initializes a new instance of the PhoneNumberRestClient class.
   * @param apiVersion Version of API to invoke
   * @param endpoint The endpoint of the Azure Communication resource.
   * @param [options] The parameter options
   */
  constructor(apiVersion: string, endpoint: string, options?: coreHttp.ServiceClientOptions) {
    super(apiVersion, endpoint, options);
    this.phoneNumberAdministration = new operations.PhoneNumberAdministration(this);
  }
}

// Operation Specifications

export {
  PhoneNumberRestClient,
  PhoneNumberRestClientContext,
  Models as PhoneNumberRestModels,
  Mappers as PhoneNumberRestMappers
};
export * from "./operations";