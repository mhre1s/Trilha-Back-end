import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[ERRO API]:', err);

  if (err instanceof ZodError) {
    return res.status(422).json({
      erro: 'Dados de requisição inválidos (Erro de Validação Schema).',
      detalhes: err.errors.map(e => ({ campo: e.path.join('.'), mensagem: e.message }))
    });
  }

  const statusCode = err.statusCode || 500;
  const mensagem = err.message || 'Erro interno no servidor.';

  return res.status(statusCode).json({
    erro: mensagem,
    timestamp: new Date().toISOString(),
    caminho: req.originalUrl
  });
}
