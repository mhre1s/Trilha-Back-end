import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../models/types';

export const JWT_SECRET = process.env.JWT_SECRET || 'raizes_do_nordeste_secret_key_2026_multidisciplinar';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    papel: UserRole;
    unidadeId?: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ erro: 'Não autorizado: Token JWT não fornecido no cabeçalho Authorization.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ erro: 'Não autorizado: Formato de token inválido. Use "Bearer <token>".' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Não autorizado: Token JWT expirado ou inválido.' });
  }
}

export function roleMiddleware(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ erro: 'Não autorizado: Usuário não autenticado.' });
    }

    if (!allowedRoles.includes(req.user.papel)) {
      return res.status(403).json({
        erro: `Acesso negado: O perfil '${req.user.papel}' não possui permissão para este recurso. Perfis autorizados: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
}
