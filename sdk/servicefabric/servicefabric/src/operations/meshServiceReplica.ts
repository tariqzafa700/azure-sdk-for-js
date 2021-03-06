/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is
 * regenerated.
 */

import * as msRest from "@azure/ms-rest-js";
import * as Models from "../models";
import * as Mappers from "../models/meshServiceReplicaMappers";
import * as Parameters from "../models/parameters";
import { ServiceFabricClientContext } from "../serviceFabricClientContext";

/** Class representing a MeshServiceReplica. */
export class MeshServiceReplica {
  private readonly client: ServiceFabricClientContext;

  /**
   * Create a MeshServiceReplica.
   * @param {ServiceFabricClientContext} client Reference to the service client.
   */
  constructor(client: ServiceFabricClientContext) {
    this.client = client;
  }

  /**
   * Gets the information about the service replica with the given name. The information include the
   * description and other properties of the service replica.
   * @summary Gets the given replica of the service of an application.
   * @param applicationResourceName The identity of the application.
   * @param serviceResourceName The identity of the service.
   * @param replicaName Service Fabric replica name.
   * @param [options] The optional parameters
   * @returns Promise<Models.MeshServiceReplicaGetResponse>
   */
  get(applicationResourceName: string, serviceResourceName: string, replicaName: string, options?: msRest.RequestOptionsBase): Promise<Models.MeshServiceReplicaGetResponse>;
  /**
   * @param applicationResourceName The identity of the application.
   * @param serviceResourceName The identity of the service.
   * @param replicaName Service Fabric replica name.
   * @param callback The callback
   */
  get(applicationResourceName: string, serviceResourceName: string, replicaName: string, callback: msRest.ServiceCallback<Models.ServiceReplicaDescription>): void;
  /**
   * @param applicationResourceName The identity of the application.
   * @param serviceResourceName The identity of the service.
   * @param replicaName Service Fabric replica name.
   * @param options The optional parameters
   * @param callback The callback
   */
  get(applicationResourceName: string, serviceResourceName: string, replicaName: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.ServiceReplicaDescription>): void;
  get(applicationResourceName: string, serviceResourceName: string, replicaName: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.ServiceReplicaDescription>, callback?: msRest.ServiceCallback<Models.ServiceReplicaDescription>): Promise<Models.MeshServiceReplicaGetResponse> {
    return this.client.sendOperationRequest(
      {
        applicationResourceName,
        serviceResourceName,
        replicaName,
        options
      },
      getOperationSpec,
      callback) as Promise<Models.MeshServiceReplicaGetResponse>;
  }

  /**
   * Gets the information about all replicas of a service. The information include the description
   * and other properties of the service replica.
   * @summary Lists all the replicas of a service.
   * @param applicationResourceName The identity of the application.
   * @param serviceResourceName The identity of the service.
   * @param [options] The optional parameters
   * @returns Promise<Models.MeshServiceReplicaListResponse>
   */
  list(applicationResourceName: string, serviceResourceName: string, options?: msRest.RequestOptionsBase): Promise<Models.MeshServiceReplicaListResponse>;
  /**
   * @param applicationResourceName The identity of the application.
   * @param serviceResourceName The identity of the service.
   * @param callback The callback
   */
  list(applicationResourceName: string, serviceResourceName: string, callback: msRest.ServiceCallback<Models.PagedServiceReplicaDescriptionList>): void;
  /**
   * @param applicationResourceName The identity of the application.
   * @param serviceResourceName The identity of the service.
   * @param options The optional parameters
   * @param callback The callback
   */
  list(applicationResourceName: string, serviceResourceName: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.PagedServiceReplicaDescriptionList>): void;
  list(applicationResourceName: string, serviceResourceName: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.PagedServiceReplicaDescriptionList>, callback?: msRest.ServiceCallback<Models.PagedServiceReplicaDescriptionList>): Promise<Models.MeshServiceReplicaListResponse> {
    return this.client.sendOperationRequest(
      {
        applicationResourceName,
        serviceResourceName,
        options
      },
      listOperationSpec,
      callback) as Promise<Models.MeshServiceReplicaListResponse>;
  }
}

// Operation Specifications
const serializer = new msRest.Serializer(Mappers);
const getOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "Resources/Applications/{applicationResourceName}/Services/{serviceResourceName}/Replicas/{replicaName}",
  urlParameters: [
    Parameters.applicationResourceName,
    Parameters.serviceResourceName,
    Parameters.replicaName
  ],
  queryParameters: [
    Parameters.apiVersion8
  ],
  responses: {
    200: {
      bodyMapper: Mappers.ServiceReplicaDescription
    },
    default: {
      bodyMapper: Mappers.FabricError
    }
  },
  serializer
};

const listOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "Resources/Applications/{applicationResourceName}/Services/{serviceResourceName}/Replicas",
  urlParameters: [
    Parameters.applicationResourceName,
    Parameters.serviceResourceName
  ],
  queryParameters: [
    Parameters.apiVersion8
  ],
  responses: {
    200: {
      bodyMapper: Mappers.PagedServiceReplicaDescriptionList
    },
    default: {
      bodyMapper: Mappers.FabricError
    }
  },
  serializer
};
