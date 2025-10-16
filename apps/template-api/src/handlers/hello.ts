import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async () => {
  const appName = process.env.APP_NAME || 'unknown';
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: `Hello from ${appName} in ${nodeEnv}!`,
      timestamp: new Date().toISOString(),
    }),
  };
};
