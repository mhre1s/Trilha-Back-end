import { Response } from 'express';
import { z } from 'zod';
import { getQuery, runQuery } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { Usuario } from '../models/types';

const consentimentoSchema = z.object({
  consentiuMarketing: z.boolean(),
  consentiuFidelidade: z.boolean(),
  consentiuPerfilamento: z.boolean()
});

export class LgpdController {
  // Atualizar/Registrar consentimento explícito LGPD
  static async registrarConsentimento(req: AuthenticatedRequest, res: Response) {
    const data = consentimentoSchema.parse(req.body);
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({ erro: 'Usuário não autenticado.' });
    }

    const consentId = `lgpd-${Date.now()}`;
    const agora = new Date().toISOString();
    const ipOrigem = req.ip || '127.0.0.1';

    await runQuery(
      `INSERT INTO consentimento_lgpd (id, usuarioId, versaoTermo, consentiuMarketing, consentiuFidelidade, consentiuPerfilamento, ipOrigem, dataConsentimento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        consentId,
        usuarioId,
        'v1.2-2026',
        data.consentiuMarketing ? 1 : 0,
        data.consentiuFidelidade ? 1 : 0,
        data.consentiuPerfilamento ? 1 : 0,
        ipOrigem,
        agora
      ]
    );

    return res.status(200).json({
      mensagem: 'Consentimento LGPD atualizado e registrado com sucesso.',
      consentimento: {
        id: consentId,
        usuarioId,
        dataConsentimento: agora,
        ipOrigem
      }
    });
  }

  // Exportação de dados pessoais (Direito de Acesso do Titular - Art. 18 LGPD)
  static async exportarMeusDados(req: AuthenticatedRequest, res: Response) {
    const usuarioId = req.user?.id;

    const usuario = await getQuery<Usuario>(
      `SELECT id, nome, email, cpf, telefone, dataNascimento, papel, criadoEm, anonimizado FROM usuarios WHERE id = ?`,
      [usuarioId]
    );

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const consentimentos = await getQuery(
      `SELECT * FROM consentimento_lgpd WHERE usuarioId = ? ORDER BY dataConsentimento DESC LIMIT 1`,
      [usuarioId]
    );

    const historicoPedidos = await getQuery(
      `SELECT id, codigoDisplay, valorFinal, criadoEm FROM pedidos WHERE clienteId = ?`,
      [usuarioId]
    );

    return res.status(200).json({
      relatorioLGPD: {
        titulo: 'Exportação de Dados Pessoais do Titular - Lei Geral de Proteção de Dados (Lei 13.709/2018)',
        geradoEm: new Date().toISOString(),
        titular: usuario,
        consentimentosAtivos: consentimentos || null,
        historicoPedidos: historicoPedidos || []
      }
    });
  }

  // Solicitacão de exclusão e anonimização de dados (Direito ao Esquecimento - Art. 18 LGPD)
  static async anonimizarUsuario(req: AuthenticatedRequest, res: Response) {
    const usuarioId = req.user?.id;

    const usuario = await getQuery<Usuario>(`SELECT * FROM usuarios WHERE id = ?`, [usuarioId]);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    if (usuario.anonimizado) {
      return res.status(400).json({ erro: 'Este perfil de usuário já se encontra anonimizado.' });
    }

    const agora = new Date().toISOString();

    // Anonimizar dados pessoais identificáveis (PII) substituindo por hashes irreversíveis
    await runQuery(
      `UPDATE usuarios 
       SET nome = 'USUARIO_ANONIMIZADO_LGPD',
           email = ?,
           cpf = NULL,
           telefone = NULL,
           dataNascimento = NULL,
           senhaHash = 'ANONIMIZADO',
           anonimizado = 1
       WHERE id = ?`,
      [`anonimo_${Date.now()}@lgpd-removido.invalid`, usuarioId]
    );

    // Auditoria
    await runQuery(
      `INSERT INTO logs_auditoria (id, usuarioId, usuarioNome, unidadeId, acao, recurso, detalhes, dataHora, ipOrigem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `aud-${Date.now()}`,
        usuarioId,
        'TITULAR_LGPD',
        null,
        'ANONIMIZACAO_DIREITO_AO_ESQUECIMENTO',
        `Usuario ID: ${usuarioId}`,
        'Dados pessoais do titular foram anonimizados conforme exigência do Art. 18 da LGPD. Histórico fiscal mantido anonimamente.',
        agora,
        req.ip || '127.0.0.1'
      ]
    );

    return res.status(200).json({
      mensagem: 'Seus dados pessoais foram anonimizados com sucesso. Sua conta foi desativada em conformidade com a LGPD.',
      usuarioId,
      status: 'ANONIMIZADO'
    });
  }
}
