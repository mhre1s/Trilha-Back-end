import { Response } from 'express';
import { z } from 'zod';
import { allQuery, getQuery, runQuery } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { CanalPedido, StatusPedido, Pedido, Produto, EstoqueItem } from '../models/types';

const criarPedidoSchema = z.object({
  unidadeId: z.string().min(1, 'ID da unidade é obrigatório.'),
  canal: z.nativeEnum(CanalPedido),
  clienteId: z.string().optional(),
  itens: z.array(
    z.object({
      produtoId: z.string().min(1),
      quantidade: z.number().int().positive('Quantidade deve ser maior que zero.'),
      observacoes: z.string().optional()
    })
  ).min(1, 'O pedido deve conter pelo menos um item.')
});

export class PedidoController {
  // Criar Pedido (Omnicanal)
  static async criar(req: AuthenticatedRequest, res: Response) {
    const data = criarPedidoSchema.parse(req.body);

    // 1. Validar Unidade
    const unidade = await getQuery(`SELECT id FROM unidades WHERE id = ? AND ativa = 1`, [data.unidadeId]);
    if (!unidade) {
      return res.status(404).json({ erro: 'Unidade selecionada não encontrada ou inativa.' });
    }

    // 2. Processar itens, calcular totais e verificar estoque local
    let valorTotal = 0;
    const itensProcessados: Array<{
      produtoId: string;
      nome: string;
      quantidade: number;
      precoUnitario: number;
      precoTotal: number;
      observacoes?: string;
    }> = [];

    for (const item of data.itens) {
      const prod = await getQuery<Produto>(`SELECT * FROM produtos WHERE id = ?`, [item.produtoId]);
      if (!prod) {
        return res.status(404).json({ erro: `Produto ID '${item.produtoId}' não encontrado no catálogo.` });
      }

      // Verificar disponibilidade no cardápio da unidade
      const cardapioItem = await getQuery(
        `SELECT precoUnidade, disponivel FROM cardapio_itens WHERE unidadeId = ? AND produtoId = ? AND disponivel = 1`,
        [data.unidadeId, item.produtoId]
      );

      if (!cardapioItem) {
        return res.status(400).json({
          erro: `O produto '${prod.nome}' não está disponível no cardápio desta unidade.`
        });
      }

      // Verificar estoque local
      const estoque = await getQuery<EstoqueItem>(
        `SELECT quantidadeAtual FROM estoque_itens WHERE unidadeId = ? AND produtoId = ?`,
        [data.unidadeId, item.produtoId]
      );

      if (estoque && estoque.quantidadeAtual < item.quantidade) {
        return res.status(422).json({
          erro: `Estoque insuficiente para o produto '${prod.nome}'. Solicitado: ${item.quantidade}, Disponível: ${estoque.quantidadeAtual}.`
        });
      }

      const precoUnitario = cardapioItem.precoUnidade;
      const subtotal = precoUnitario * item.quantidade;
      valorTotal += subtotal;

      itensProcessados.push({
        produtoId: item.produtoId,
        nome: prod.nome,
        quantidade: item.quantidade,
        precoUnitario,
        precoTotal: subtotal,
        observacoes: item.observacoes
      });
    }

    // 3. Calcular desconto de fidelidade se houver clienteId
    let valorDesconto = 0;
    let clienteIdFinal = data.clienteId || (req.user?.papel === 'CLIENTE' ? req.user.id : undefined);

    if (clienteIdFinal) {
      // Exemplo de regra de fidelização simples: 5% para clientes cadastrados
      valorDesconto = Number((valorTotal * 0.05).toFixed(2));
    }

    const valorFinal = Number((valorTotal - valorDesconto).toFixed(2));
    const pontosGanhos = Math.floor(valorFinal); // 1 ponto por R$ 1,00

    const pedidoId = `ped-${Date.now()}`;
    const codigoDisplay = `#RN-${Math.floor(1000 + Math.random() * 9000)}`;
    const agora = new Date().toISOString();

    // 4. Salvar Pedido
    await runQuery(
      `INSERT INTO pedidos (id, codigoDisplay, unidadeId, clienteId, canal, status, valorTotal, valorDesconto, valorFinal, pontosFidelidadeGanhos, criadoEm, atualizadoEm)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pedidoId,
        codigoDisplay,
        data.unidadeId,
        clienteIdFinal || null,
        data.canal,
        StatusPedido.AGUARDANDO_PAGAMENTO,
        valorTotal,
        valorDesconto,
        valorFinal,
        pontosGanhos,
        agora,
        agora
      ]
    );

    // 5. Salvar Itens e Abater Estoque
    for (const item of itensProcessados) {
      const itemId = `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await runQuery(
        `INSERT INTO itens_pedido (id, pedidoId, produtoId, nomeProduto, quantidade, precoUnitario, precoTotal, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, pedidoId, item.produtoId, item.nome, item.quantidade, item.precoUnitario, item.precoTotal, item.observacoes || null]
      );

      // Baixa no estoque local
      await runQuery(
        `UPDATE estoque_itens SET quantidadeAtual = quantidadeAtual - ?, ultimaAtualizacao = ? WHERE unidadeId = ? AND produtoId = ?`,
        [item.quantidade, agora, data.unidadeId, item.produtoId]
      );
    }

    return res.status(201).json({
      mensagem: 'Pedido criado com sucesso! Aguardando pagamento.',
      pedido: {
        id: pedidoId,
        codigoDisplay,
        unidadeId: data.unidadeId,
        canal: data.canal,
        status: StatusPedido.AGUARDANDO_PAGAMENTO,
        valorTotal,
        valorDesconto,
        valorFinal,
        pontosFidelidadeGanhos: pontosGanhos,
        itens: itensProcessados,
        criadoEm: agora
      }
    });
  }

  // Obter detalhes de um pedido
  static async obterPorId(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const pedido = await getQuery<Pedido>(`SELECT * FROM pedidos WHERE id = ? OR codigoDisplay = ?`, [id, id]);

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    const itens = await allQuery(`SELECT * FROM itens_pedido WHERE pedidoId = ?`, [pedido.id]);
    const pagamento = await getQuery(`SELECT * FROM pagamentos WHERE pedidoId = ? ORDER BY criadoEm DESC LIMIT 1`, [pedido.id]);

    return res.status(200).json({
      pedido,
      itens,
      pagamento: pagamento || null
    });
  }

  // Listar pedidos (com filtro por unidade e status)
  static async listar(req: AuthenticatedRequest, res: Response) {
    const { unidadeId, status } = req.query;
    let sql = `SELECT * FROM pedidos WHERE 1=1`;
    const params: any[] = [];

    if (unidadeId) {
      sql += ` AND unidadeId = ?`;
      params.push(unidadeId);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY criadoEm DESC LIMIT 50`;
    const pedidos = await allQuery<Pedido>(sql, params);
    return res.status(200).json({ pedidos });
  }

  // Cancelamento com auditoria
  static async cancelar(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { motivo } = req.body;

    const pedido = await getQuery<Pedido>(`SELECT * FROM pedidos WHERE id = ?`, [id]);
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    if (pedido.status === StatusPedido.CANCELADO) {
      return res.status(400).json({ erro: 'Pedido já se encontra cancelado.' });
    }

    const agora = new Date().toISOString();

    // Atualiza status para CANCELADO
    await runQuery(`UPDATE pedidos SET status = ?, atualizadoEm = ? WHERE id = ?`, [StatusPedido.CANCELADO, agora, id]);

    // Devolve itens ao estoque
    const itens = await allQuery(`SELECT produtoId, quantidade FROM itens_pedido WHERE pedidoId = ?`, [id]);
    for (const item of itens) {
      await runQuery(
        `UPDATE estoque_itens SET quantidadeAtual = quantidadeAtual + ?, ultimaAtualizacao = ? WHERE unidadeId = ? AND produtoId = ?`,
        [item.quantidade, agora, pedido.unidadeId, item.produtoId]
      );
    }

    // Registra auditoria obrigatória de operacão sensível
    const auditId = `aud-${Date.now()}`;
    await runQuery(
      `INSERT INTO logs_auditoria (id, usuarioId, usuarioNome, unidadeId, acao, recurso, detalhes, dataHora, ipOrigem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditId,
        req.user?.id || 'SISTEMA',
        req.user?.email || 'Sistema/Atendimento',
        pedido.unidadeId,
        'CANCELAMENTO_PEDIDO',
        `Pedido ID: ${pedido.id} (${pedido.codigoDisplay})`,
        `Cancelamento efetuado. Motivo: ${motivo || 'Sem justificativa preenchida.'}`,
        agora,
        req.ip || '127.0.0.1'
      ]
    );

    return res.status(200).json({
      mensagem: 'Pedido cancelado com sucesso. Itens estornados ao estoque e evento registrado em auditoria.',
      pedidoId: id,
      novoStatus: StatusPedido.CANCELADO
    });
  }
}
