type HTTPLambdaRequest = {
  resource: string;
  path: string;
  httpMethod: "POST" | "GET";
  headers: { "Content-Type": string; "Authorization": string };
  multiValueHeaders: { "Content-Type": [string] };
  queryStringParameters: any;
  multiValueQueryStringParameters: any;
  pathParameters: any;
  stageVariables: any;
  requestContext: {
    resourceId: string;
    resourcePath: string;
    httpMethod: "POST" | "GET";
    extendedRequestId: string;
    requestTime: string;
    path: string;
    accountId: string;
    protocol: "HTTP/1.1";
    stage: string;
    domainPrefix: string;
    requestTimeEpoch: number;
    requestId: string;
    identity: {
      cognitoIdentityPoolId: any;
      cognitoIdentityId: any;
      apiKey: string;
      principalOrgId: any;
      cognitoAuthenticationType: any;
      userArn: string;
      apiKeyId: string;
      userAgent: string;
      accountId: string;
      caller: string;
      sourceIp: string;
      accessKey: string;
      cognitoAuthenticationProvider: any;
      user: string;
    };
    domainName: string;
    apiId: string;
  };
  body: string;
  isBase64Encoded: false;
};

type LambdaResponse = {
  statusCode: number;
  headers: {
    "Content-Type": string;
  };
  body: any;
  isBase64Encoded: boolean;
};

type LambdaCallback = (arg1: null, response: LambdaResponse) => void;
