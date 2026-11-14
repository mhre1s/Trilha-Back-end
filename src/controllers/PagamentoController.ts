import { Request, Response } from 'express';
import { z } from 'zod';
import { getQuery, runQuery } from '../config/database';
import { FormaPagamento, StatusPagamento, StatusPedido, Pagamento, Pedido } from '../models/types';

const solicitarPagamentoSchema = z.object({
  pedidoId: z.string().min(1, 'ID do pedido é obrigatório.'),
  formaPagamento: z.nativeEnum(FormaPagamento),
  chaveIdempotencia: z.string().min(8, 'Chave de idempotência única é obrigatória.')
});

const webhookPagamentoSchema = z.object({
  chaveIdempotencia: z.string().min(8),
  transacaoExternaId: z.string().min(1),
  statusGateway: z.enum(['SUCCESS', 'FAILED', 'REFUNDED']),
  valor: z.number().positive(),
  mensagemGateway: z.string().optional()
});

export class PagamentoController {
  // Solicitar Pagamento ao Gateway Externo (Desacoplado)
  static async solicitarPagamento(req: Request, res: Response) {
    const data = solicitarPagamentoSchema.parse(req.body);

    // 1. Verificar idempotência prévia
    const pagamentoExistente = await getQuery<Pagamento>(
      `SELECT * FROM pagamentos WHERE chaveIdempotencia = ?`,
      [data.chaveIdempotencia]
    );

    if (pagamentoExistente) {
      return res.status(200).json({
        mensagem: 'Transação idempotente já registrada anteriormente.',
        pagamento: pagamentoExistente,
        idempotente: true
      });
    }

    // 2. Obter Pedido
    const pedido = await getQuery<Pedido>(`SELECT * FROM pedidos WHERE id = ?`, [data.pedidoId]);
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    if (pedido.status === StatusPedido.PAGO) {
      return res.status(400).json({ erro: 'Este pedido já se encontra pago.' });
    }

    const pagamentoId = `pag-${Date.now()}`;
    const agora = new Date().toISOString();

    // 3. Registrar intenção de pagamento como PENDENTE
    await runQuery(
      `INSERT INTO pagamentos (id, pedidoId, transacaoExternaId, chaveIdempotencia, formaPagamento, valor, status, mensagemGateway, criadoEm, atualizadoEm)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pagamentoId,
        data.pedidoId,
        `TX-${Date.now()}`,
        data.chaveIdempotencia,
        data.formaPagamento,
        pedido.valorFinal,
        StatusPagamento.PENDENTE,
        'Aguardando confirmação do gateway externo',
        agora,
        agora
      ]
    );

    // Simulação do payload retornado para o cliente pagar (ex.: QRCode PIX ou URL Checkout)
    return res.status(202).json({
      mensagem: 'Solicitação de pagamento enviada com sucesso ao serviço externo.',
      pagamentoId,
      chaveIdempotencia: data.chaveIdempotencia,
      valor: pedido.valorFinal,
      status: StatusPagamento.PENDENTE,
      qrCodePix: data.formaPagamento === FormaPagamento.PIX ? `00020126580014BR.GOV.BCB.PIX0136raizes-${pedido.id}5204000053039865405${pedido.valorFinal}5802BR5920Raizes do Nordeste6006Recife62070503***6304E8A2` : null
    });
  }

  // Webhook para Recepção de Notificação Assíncrona do Gateway (Idempotente)
  static async webhookGateway(req: Request, res: Response) {
    const data = webhookPagamentoSchema.parse(req.body);

    const pagamento = await getQuery<Pagamento>(
      `SELECT * FROM pagamentos WHERE chaveIdempotencia = ?`,
      [data.chaveIdempotencia]
    );

    if (!pagamento) {
      return res.status(404).json({ erro: 'Nenhum registro de pagamento pendente encontrado para a chave de idempotência fornecida.' });
    }

    if (pagamento.status === StatusPagamento.APROVADO) {
      return res.status(200).json({
        mensagem: 'Webhook duplicado recebido e ignorado com sucesso (Idempotência mantida).',
        pagamentoId: pagamento.id,
        statusAtual: pagamento.status
      });
    }

    const agora = new Date().toISOString();
    const novoStatusPagamento = data.statusGateway === 'SUCCESS' ? StatusPagamento.APROVADO : StatusPagamento.REJEITADO;

    // Atualiza registro do Pagamento
    await runQuery(
      `UPDATE pagamentos SET status = ?, transacaoExternaId = ?, mensagemGateway = ?, atualizadoEm = ? WHERE id = ?`,
      [novoStatusPagamento, data.transacaoExternaId, data.mensagemGateway || 'Transação processada pelo gateway', agora, pagamento.id]
    );

    // Se aprovado, atualiza o status do pedido para PAGO e inicia preparação na cozinha
    if (novoStatusPagamento === StatusPagamento.APROVADO) {
      await runQuery(
        `UPDATE pedidos SET status = ?, atualizadoEm = ? WHERE id = ?`,
        [StatusPedido.EM_PREPARACAO, agora, pagamento.pedidoId]
      );
    }

    return res.status(200).json({
      mensagem: 'Notificação de pagamento processada com sucesso.',
      pagamentoId: pagamento.id,
      pedidoId: pagamento.pedidoId,
      statusPagamento: novoStatusPagamento,
      statusPedido: novoStatusPagamento === StatusPagamento.APROVADO ? StatusPedido.EM_PREPARACAO : StatusPedido.AGUARDANDO_PAGAMENTO
    });
  }
}
