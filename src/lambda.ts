import * as express from 'express';
import serverlessExpress from '@vendia/serverless-express';
import { createNestApplication } from './bootstrap';

let cachedServer: any;

async function bootstrapServer() {
    if (cachedServer) {
        return cachedServer;
    }

    const expressApp = express();
    const { app } = await createNestApplication(expressApp);
    await app.init();

    cachedServer = serverlessExpress({ app: expressApp });
    return cachedServer;
}

export const handler = async (event: any, context: any) => {
    const server = await bootstrapServer();
    return server(event, context);
};


