import { Request, Response } from 'express';
import { allQuery, getQuery } from '../config/database';
import { ExtratoFidelidade } from '../models/types';

export class FidelizacaoController {
  static async obterExtrato(req: Request, res: Response) {
    const { clienteId } = req.params;

    const cliente = await getQuery(`SELECT id, nome, email, anonimizado FROM usuarios WHERE id = ?`, [clienteId]);
    if (!cliente) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }

    if (cliente.anonimizado) {
      return res.status(400).json({ erro: 'Conta de cliente anonimizada.' });
    }

    // Somar pontos de pedidos pagos
    const pontosRes = await getQuery<{ totalPontos: number }>(
      `SELECT COALESCE(SUM(pontosFidelidadeGanhos), 0) as totalPontos FROM pedidos WHERE clienteId = ? AND status != 'CANCELADO'`,
      [clienteId]
    );

    const pontosAcumulados = pontosRes?.totalPontos || 0;

    // Regra de níveis de fidelização
    let nivelCliente: 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE' = 'BRONZE';
    let percentualDesconto = 5; // 5% base

    if (pontosAcumulados >= 500) {
      nivelCliente = 'DIAMANTE';
      percentualDesconto = 15;
    } else if (pontosAcumulados >= 250) {
      nivelCliente = 'OURO';
      percentualDesconto = 10;
    } else if (pontosAcumulados >= 100) {
      nivelCliente = 'PRATA';
      percentualDesconto = 7.5;
    }

    const pedidos = await allQuery(
      `SELECT criadoEm as data, codigoDisplay, valorFinal, pontosFidelidadeGanhos as pontos FROM pedidos WHERE clienteId = ? AND status != 'CANCELADO' ORDER BY criadoEm DESC`,
      [clienteId]
    );

    const extrato: ExtratoFidelidade = {
      clienteId,
      pontosAcumulados,
      nivelCliente,
      percentualDesconto,
      historico: pedidos.map((p: any) => ({
        data: p.data,
        descricao: `Pontos referentes ao Pedido ${p.codigoDisplay} (Valor: R$ ${p.valorFinal.toFixed(2)})`,
        pontos: p.pontos,
        tipo: 'GANHO'
      }))
    };

    return res.status(200).json({ extrato });
  }
}
