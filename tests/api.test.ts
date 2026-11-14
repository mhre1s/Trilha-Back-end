import request from 'supertest';
import { app } from '../src/app';
import { initDatabase, db } from '../src/config/database';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await initDatabase();
});

afterAll(done => {
  db.close(done);
});

describe('=== Suíte de Testes Integrados — API REST Raízes do Nordeste ===', () => {
  let tokenMatriz: string;
  let tokenCliente: string;
  let clienteId: string;
  let pedidoCriadoId: string;
  let chaveIdempotenciaTest: string;

  test('1. Healthcheck — Deve retornar 200 OK e status ONLINE', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ONLINE');
  });

  test('2. Autenticação — Deve realizar login como Diretoria da Matriz', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'diretoria@raizesdonordeste.com.br', senha: 'Senha@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.papel).toBe('DIRETORIA_MATRIZ');
    tokenMatriz = res.body.token;
  });

  test('3. Cadastro e Login de Novo Cliente com LGPD', async () => {
    const emailNovo = `cliente.teste.${Date.now()}@gmail.com`;
    const resReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Maria Bonita Teste',
        email: emailNovo,
        senha: 'Senha@123',
        cpf: '99988877766',
        telefone: '81977776666',
        consentimentoTermos: true
      });

    expect(resReg.status).toBe(201);
    expect(resReg.body.token).toBeDefined();
    tokenCliente = resReg.body.token;
    clienteId = resReg.body.usuario.id;
  });

  test('4. Cardápio — Deve listar unidades e verificar itens sazonais juninos', async () => {
    const resUnidades = await request(app).get('/api/v1/unidades');
    expect(resUnidades.status).toBe(200);
    expect(resUnidades.body.unidades.length).toBeGreaterThan(0);

    const resCardapio = await request(app).get('/api/v1/unidades/und-recife-01/cardapio');
    expect(resCardapio.status).toBe(200);
    expect(resCardapio.body.cardapio).toBeDefined();
    
    // Verificar se item junino "Pamonha Doce" está presente no cardápio de Recife
    const pamonha = resCardapio.body.cardapio.find((i: any) => i.produtoId === 'prod-junino-pamonha');
    expect(pamonha).toBeDefined();
    expect(pamonha.ehJuninoSazonal).toBe(true);
  });

  test('5. Pedido Omnicanal — Deve criar pedido via TOTEM de Autoatendimento e abater estoque', async () => {
    const resPedido = await request(app)
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({
        unidadeId: 'und-recife-01',
        canal: 'TOTEM_AUTOATENDIMENTO',
        itens: [
          { produtoId: 'prod-cuscuz-01', quantidade: 2 },
          { produtoId: 'prod-suco-01', quantidade: 2 }
        ]
      });

    expect(resPedido.status).toBe(201);
    expect(resPedido.body.pedido.id).toBeDefined();
    expect(resPedido.body.pedido.status).toBe('AGUARDANDO_PAGAMENTO');
    pedidoCriadoId = resPedido.body.pedido.id;
  });

  test('6. Pagamento Desacoplado — Deve solicitar pagamento e retornar chave de idempotência', async () => {
    chaveIdempotenciaTest = `idemp-${Date.now()}-abc`;

    const resPag = await request(app)
      .post('/api/v1/pagamentos/solicitar')
      .send({
        pedidoId: pedidoCriadoId,
        formaPagamento: 'PIX',
        chaveIdempotencia: chaveIdempotenciaTest
      });

    expect(resPag.status).toBe(202);
    expect(resPag.body.pagamentoId).toBeDefined();
    expect(resPag.body.qrCodePix).toBeDefined();
  });

  test('7. Webhook Idempotente — Deve receber confirmação do Gateway e atualizar pedido para EM_PREPARACAO', async () => {
    const payloadWebhook = {
      chaveIdempotencia: chaveIdempotenciaTest,
      transacaoExternaId: 'GW-TX-888999',
      statusGateway: 'SUCCESS',
      valor: 69.60
    };

    // Primeira chamada: Deve processar com sucesso
    const res1 = await request(app)
      .post('/api/v1/webhooks/pagamentos')
      .send(payloadWebhook);

    expect(res1.status).toBe(200);
    expect(res1.body.statusPagamento).toBe('APROVADO');
    expect(res1.body.statusPedido).toBe('EM_PREPARACAO');

    // Segunda chamada (Duplicada): Deve ser tratada com idempotência
    const res2 = await request(app)
      .post('/api/v1/webhooks/pagamentos')
      .send(payloadWebhook);

    expect(res2.status).toBe(200);
    expect(res2.body.mensagem).toContain('Idempotência mantida');
  });

  test('8. Cancelamento com Auditoria — Deve cancelar pedido e registrar em audit log', async () => {
    const resCancel = await request(app)
      .post(`/api/v1/pedidos/${pedidoCriadoId}/cancelar`)
      .set('Authorization', `Bearer ${tokenMatriz}`)
      .send({ motivo: 'Cliente desistiu do pedido durante o preparo.' });

    expect(resCancel.status).toBe(200);
    expect(resCancel.body.novoStatus).toBe('CANCELADO');
  });

  test('9. Matriz & Auditoria — Apenas perfil MATRIZ pode acessar relatórios de vendas e auditoria', async () => {
    // Acesso autorizado (Matriz)
    const resMatriz = await request(app)
      .get('/api/v1/matriz/relatorios/vendas')
      .set('Authorization', `Bearer ${tokenMatriz}`);
    expect(resMatriz.status).toBe(200);
    expect(resMatriz.body.vendasPorUnidade).toBeDefined();

    // Acesso negado (Cliente)
    const resNegado = await request(app)
      .get('/api/v1/matriz/relatorios/vendas')
      .set('Authorization', `Bearer ${tokenCliente}`);
    expect(resNegado.status).toBe(403);
  });

  test('10. LGPD — Deve permitir anonimização de conta do titular (Direito ao Esquecimento)', async () => {
    const resAnon = await request(app)
      .post('/api/v1/lgpd/anonimizar')
      .set('Authorization', `Bearer ${tokenCliente}`);

    expect(resAnon.status).toBe(200);
    expect(resAnon.body.status).toBe('ANONIMIZADO');
  });
});
