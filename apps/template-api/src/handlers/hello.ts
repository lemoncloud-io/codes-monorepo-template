import { APIGatewayProxyHandler } from 'aws-lambda';
import { HelloWorldResponse, HelloWorldMetadata } from '@shared/core';

export const handler: APIGatewayProxyHandler = async () => {
  const metadata: HelloWorldMetadata = {
    appName: process.env.APP_NAME || 'unknown',
    environment: process.env.NODE_ENV || 'development',
  };

  const response: HelloWorldResponse = {
    message: `Hello from ${metadata.appName} in ${metadata.environment}!`,
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(response),
  };
};
