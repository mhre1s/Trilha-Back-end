import { Request, Response } from 'express';
import { allQuery, getQuery } from '../config/database';

export class MatrizController {
  // Relatório Consolidado de Vendas por Unidade e Região
  static async relatorioVendas(req: Request, res: Response) {
    const vendasPorUnidade = await allQuery(`
      SELECT 
        u.id as unidadeId,
        u.nome as unidadeNome,
        u.cidade,
        u.estado,
        COUNT(p.id) as totalPedidos,
        SUM(CASE WHEN p.status != 'CANCELADO' THEN p.valorFinal ELSE 0 END) as faturamentoTotal,
        SUM(CASE WHEN p.status = 'CANCELADO' THEN 1 ELSE 0 END) as pedidosCancelados
      FROM unidades u
      LEFT JOIN pedidos p ON u.id = p.unidadeId
      GROUP BY u.id, u.nome, u.cidade, u.estado
    `);

    const produtosMaisVendidos = await allQuery(`
      SELECT 
        p.id as produtoId,
        p.nome as produtoNome,
        p.categoria,
        SUM(ip.quantidade) as totalUnidadesVendidas,
        SUM(ip.precoTotal) as receitaGerada
      FROM itens_pedido ip
      JOIN produtos p ON ip.produtoId = p.id
      JOIN pedidos ped ON ip.pedidoId = ped.id
      WHERE ped.status != 'CANCELADO'
      GROUP BY p.id, p.nome, p.categoria
      ORDER BY totalUnidadesVendidas DESC
      LIMIT 10
    `);

    const vendasPorCanal = await allQuery(`
      SELECT 
        canal,
        COUNT(id) as totalPedidos,
        SUM(valorFinal) as faturamento
      FROM pedidos
      WHERE status != 'CANCELADO'
      GROUP BY canal
    `);

    return res.status(200).json({
      resumoGeral: {
        geradoEm: new Date().toISOString(),
        unidadesReportadas: vendasPorUnidade.length
      },
      vendasPorUnidade,
      produtosMaisVendidos,
      vendasPorCanal
    });
  }

  // Consulta de Logs de Auditoria de Operações Sensíveis para a Matriz
  static async consultarAuditoria(req: Request, res: Response) {
    const logs = await allQuery(
      `SELECT * FROM logs_auditoria ORDER BY dataHora DESC LIMIT 100`
    );

    return res.status(200).json({ logs });
  }
}
