import { Request, Response } from 'express';
import { z } from 'zod';
import { allQuery, getQuery, runQuery } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { EstoqueItem } from '../models/types';

const ajustarEstoqueSchema = z.object({
  quantidadeNova: z.number().nonnegative('Quantidade não pode ser negativa.'),
  motivoAjuste: z.string().min(5, 'Justificativa do ajuste de estoque é obrigatória.')
});

export class EstoqueController {
  // Obter estoque de uma unidade
  static async obterEstoqueUnidade(req: Request, res: Response) {
    const { unidadeId } = req.params;
    const itens = await allQuery(
      `SELECT e.id, e.unidadeId, e.produtoId, p.nome as nomeProduto, p.categoria, e.quantidadeAtual, e.quantidadeMinima, e.unidadeMedida, e.ultimaAtualizacao
       FROM estoque_itens e
       JOIN produtos p ON e.produtoId = p.id
       WHERE e.unidadeId = ?`,
      [unidadeId]
    );

    return res.status(200).json({
      unidadeId,
      itens: itens.map((i: any) => ({
        ...i,
        alertaEstoqueBaixo: i.quantidadeAtual <= i.quantidadeMinima
      }))
    });
  }

  // Ajustar estoque local (operação sensível de gerente/atendente com auditoria)
  static async ajustarEstoque(req: AuthenticatedRequest, res: Response) {
    const { unidadeId, produtoId } = req.params;
    const data = ajustarEstoqueSchema.parse(req.body);

    const estoque = await getQuery<EstoqueItem>(
      `SELECT * FROM estoque_itens WHERE unidadeId = ? AND produtoId = ?`,
      [unidadeId, produtoId]
    );

    const agora = new Date().toISOString();

    if (!estoque) {
      // Criar novo registro de estoque
      const id = `est-${Date.now()}`;
      await runQuery(
        `INSERT INTO estoque_itens (id, unidadeId, produtoId, quantidadeAtual, quantidadeMinima, unidadeMedida, ultimaAtualizacao)
         VALUES (?, ?, ?, ?, 10, 'UNIDADE', ?)`,
        [id, unidadeId, produtoId, data.quantidadeNova, agora]
      );
    } else {
      // Atualizar existente
      await runQuery(
        `UPDATE estoque_itens SET quantidadeAtual = ?, ultimaAtualizacao = ? WHERE unidadeId = ? AND produtoId = ?`,
        [data.quantidadeNova, agora, unidadeId, produtoId]
      );
    }

    // Auditoria
    await runQuery(
      `INSERT INTO logs_auditoria (id, usuarioId, usuarioNome, unidadeId, acao, recurso, detalhes, dataHora, ipOrigem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `aud-${Date.now()}`,
        req.user?.id || 'GERENTE',
        req.user?.email || 'Gerente de Loja',
        unidadeId,
        'AJUSTE_MANUAL_ESTOQUE',
        `Produto ID: ${produtoId}`,
        `Ajuste de estoque efetuado. Quantidade anterior: ${estoque?.quantidadeAtual ?? 0} -> Nova: ${data.quantidadeNova}. Motivo: ${data.motivoAjuste}`,
        agora,
        req.ip || '127.0.0.1'
      ]
    );

    return res.status(200).json({
      mensagem: 'Estoque atualizado e registrado em auditoria com sucesso.',
      unidadeId,
      produtoId,
      quantidadeNova: data.quantidadeNova
    });
  }
}
