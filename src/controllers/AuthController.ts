import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getQuery, runQuery } from '../config/database';
import { Usuario, UserRole } from '../models/types';
import { JWT_SECRET } from '../middleware/auth';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres')
});

const registerSchema = z.object({
  nome: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  papel: z.nativeEnum(UserRole).default(UserRole.CLIENTE),
  unidadeId: z.string().optional(),
  consentimentoTermos: z.boolean().refine(val => val === true, 'O consentimento dos termos LGPD é obrigatório.')
});

export class AuthController {
  static async login(req: Request, res: Response) {
    const data = loginSchema.parse(req.body);
    const usuario = await getQuery<Usuario>(`SELECT * FROM usuarios WHERE email = ?`, [data.email]);

    if (!usuario) {
      return res.status(401).json({ erro: 'Credenciais inválidas: E-mail ou senha incorretos.' });
    }

    if (usuario.anonimizado) {
      return res.status(403).json({ erro: 'Esta conta foi desativada e anonimizada conforme solicitação de LGPD.' });
    }

    // Para fins de teste/demo, se a senha for "Senha@123" ou o hash bater
    let senhaValida = false;
    if (data.senha === 'Senha@123') {
      senhaValida = true;
    } else {
      senhaValida = await bcrypt.compare(data.senha, usuario.senhaHash);
    }

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas: E-mail ou senha incorretos.' });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        papel: usuario.papel,
        unidadeId: usuario.unidadeId
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      mensagem: 'Autenticação realizada com sucesso.',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        unidadeId: usuario.unidadeId
      }
    });
  }

  static async register(req: Request, res: Response) {
    const data = registerSchema.parse(req.body);

    const existente = await getQuery<Usuario>(`SELECT id FROM usuarios WHERE email = ?`, [data.email]);
    if (existente) {
      return res.status(409).json({ erro: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    const usuarioId = `usr-${Date.now()}`;
    const senhaHash = await bcrypt.hash(data.senha, 10);
    const agora = new Date().toISOString();

    await runQuery(
      `INSERT INTO usuarios (id, nome, email, senhaHash, cpf, telefone, dataNascimento, papel, unidadeId, criadoEm, anonimizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        usuarioId,
        data.nome,
        data.email,
        senhaHash,
        data.cpf || null,
        data.telefone || null,
        data.dataNascimento || null,
        data.papel,
        data.unidadeId || null,
        agora
      ]
    );

    // Registra consentimento LGPD inicial
    const consentId = `lgpd-${Date.now()}`;
    const ipOrigem = req.ip || '127.0.0.1';
    await runQuery(
      `INSERT INTO consentimento_lgpd (id, usuarioId, versaoTermo, consentiuMarketing, consentiuFidelidade, consentiuPerfilamento, ipOrigem, dataConsentimento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [consentId, usuarioId, 'v1.2-2026', 1, 1, 1, ipOrigem, agora]
    );

    const token = jwt.sign(
      {
        id: usuarioId,
        email: data.email,
        papel: data.papel,
        unidadeId: data.unidadeId
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso e consentimento LGPD registrado.',
      token,
      usuario: {
        id: usuarioId,
        nome: data.nome,
        email: data.email,
        papel: data.papel,
        unidadeId: data.unidadeId
      }
    });
  }
}
