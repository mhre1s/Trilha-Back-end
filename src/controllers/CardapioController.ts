import { Request, Response } from 'express';
import { allQuery, getQuery } from '../config/database';
import { Unidade } from '../models/types';

export class CardapioController {
  // Lista todas as unidades ativas da rede
  static async listarUnidades(req: Request, res: Response) {
    const unidades = await allQuery<Unidade>(
      `SELECT id, nome, cidade, estado, endereco, possuiCozinhaCompleta, horarioFuncionamento, ativa FROM unidades WHERE ativa = 1`
    );
    return res.status(200).json({ unidades });
  }

  // Detalhes da unidade com o cardápio específico (respeitando restrições da cozinha e sazonalidade junina)
  static async obterCardapioUnidade(req: Request, res: Response) {
    const { id } = req.params;
    const unidade = await getQuery<Unidade>(`SELECT * FROM unidades WHERE id = ? AND ativa = 1`, [id]);

    if (!unidade) {
      return res.status(404).json({ erro: 'Unidade não encontrada ou inativa.' });
    }

    const itensCardapio = await allQuery(
      `SELECT 
        c.id as cardapioItemId,
        p.id as produtoId,
        p.nome,
        p.descricao,
        p.categoria,
        c.precoUnidade,
        c.disponivel,
        p.ehJuninoSazonal,
        COALESCE(e.quantidadeAtual, 0) as estoqueDisponivel
       FROM cardapio_itens c
       JOIN produtos p ON c.produtoId = p.id
       LEFT JOIN estoque_itens e ON e.unidadeId = c.unidadeId AND e.produtoId = p.id
       WHERE c.unidadeId = ? AND c.disponivel = 1`,
      [id]
    );

    return res.status(200).json({
      unidade: {
        id: unidade.id,
        nome: unidade.nome,
        cidade: unidade.cidade,
        possuiCozinhaCompleta: Boolean(unidade.possuiCozinhaCompleta),
        horarioFuncionamento: unidade.horarioFuncionamento
      },
      cardapio: itensCardapio.map((item: any) => ({
        cardapioItemId: item.cardapioItemId,
        produtoId: item.produtoId,
        nome: item.nome,
        descricao: item.descricao,
        categoria: item.categoria,
        preco: item.precoUnidade,
        disponivel: item.disponivel === 1,
        ehJuninoSazonal: item.ehJuninoSazonal === 1,
        estoqueDisponivel: item.estoqueDisponivel
      }))
    });
  }
}
