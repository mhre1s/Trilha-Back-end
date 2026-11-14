import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { routes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { swaggerDocument } from './swagger';

export const app = express();

app.use(cors());
app.use(express.json());

// Documentação Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rotas da API
app.use('/api/v1', routes);

// Middleware de erros
app.use(errorHandler);
