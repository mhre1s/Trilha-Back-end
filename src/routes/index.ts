import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { CardapioController } from '../controllers/CardapioController';
import { PedidoController } from '../controllers/PedidoController';
import { PagamentoController } from '../controllers/PagamentoController';
import { EstoqueController } from '../controllers/EstoqueController';
import { MatrizController } from '../controllers/MatrizController';
import { LgpdController } from '../controllers/LgpdController';
import { FidelizacaoController } from '../controllers/FidelizacaoController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { UserRole } from '../models/types';

export const routes = Router();

// 1. Healthcheck / Status
routes.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    sistema: 'API REST - Rede Raízes do Nordeste',
    versao: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 2. Autenticação e Cadastro
routes.post('/auth/login', AuthController.login);
routes.post('/auth/register', AuthController.register);

// 3. Cardápio e Unidades (Público / Omnicanal)
routes.get('/unidades', CardapioController.listarUnidades);
routes.get('/unidades/:id/cardapio', CardapioController.obterCardapioUnidade);

// 4. Gestão de Pedidos (Omnicanal)
routes.post('/pedidos', PedidoController.criar);
routes.get('/pedidos/:id', PedidoController.obterPorId);
routes.get('/pedidos', authMiddleware, PedidoController.listar);
routes.post(
  '/pedidos/:id/cancelar',
  authMiddleware,
  roleMiddleware([UserRole.GERENTE_LOJA, UserRole.DIRETORIA_MATRIZ, UserRole.ATENDENTE]),
  PedidoController.cancelar
);

// 5. Pagamento Desacoplado & Webhook com Idempotência
routes.post('/pagamentos/solicitar', PagamentoController.solicitarPagamento);
routes.post('/webhooks/pagamentos', PagamentoController.webhookGateway);

// 6. Controle de Estoque por Unidade
routes.get('/estoque/unidade/:unidadeId', authMiddleware, EstoqueController.obterEstoqueUnidade);
routes.put(
  '/estoque/unidade/:unidadeId/produto/:produtoId',
  authMiddleware,
  roleMiddleware([UserRole.GERENTE_LOJA, UserRole.DIRETORIA_MATRIZ, UserRole.ATENDENTE]),
  EstoqueController.ajustarEstoque
);

// 7. Matriz Franqueadora (Relatórios Consolidados & Auditoria)
routes.get(
  '/matriz/relatorios/vendas',
  authMiddleware,
  roleMiddleware([UserRole.DIRETORIA_MATRIZ]),
  MatrizController.relatorioVendas
);
routes.get(
  '/matriz/auditoria',
  authMiddleware,
  roleMiddleware([UserRole.DIRETORIA_MATRIZ]),
  MatrizController.consultarAuditoria
);

// 8. Conformidade LGPD
routes.post('/lgpd/consentimento', authMiddleware, LgpdController.registrarConsentimento);
routes.get('/lgpd/meus-dados', authMiddleware, LgpdController.exportarMeusDados);
routes.post('/lgpd/anonimizar', authMiddleware, LgpdController.anonimizarUsuario);

// 9. Fidelização
routes.get('/fidelizacao/extrato/:clienteId', FidelizacaoController.obterExtrato);
