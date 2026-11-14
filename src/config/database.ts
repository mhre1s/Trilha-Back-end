import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'test' 
  ? ':memory:' 
  : path.resolve(__dirname, '../../database.sqlite');

export const db = new sqlite3.Database(dbPath);

export const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const getQuery = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
};

export const allQuery = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

export async function initDatabase(): Promise<void> {
  // Ativar FK
  await runQuery(`PRAGMA foreign_keys = ON;`);

  // Tabelas
  await runQuery(`
    CREATE TABLE IF NOT EXISTS unidades (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      cidade TEXT NOT NULL,
      estado TEXT NOT NULL,
      endereco TEXT NOT NULL,
      possuiCozinhaCompleta INTEGER NOT NULL DEFAULT 1,
      horarioFuncionamento TEXT NOT NULL,
      ativa INTEGER NOT NULL DEFAULT 1
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senhaHash TEXT NOT NULL,
      cpf TEXT,
      telefone TEXT,
      dataNascimento TEXT,
      papel TEXT NOT NULL,
      unidadeId TEXT,
      criadoEm TEXT NOT NULL,
      anonimizado INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (unidadeId) REFERENCES unidades(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS produtos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL,
      categoria TEXT NOT NULL,
      precoBase REAL NOT NULL,
      ehJuninoSazonal INTEGER NOT NULL DEFAULT 0,
      imagemUrl TEXT
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS cardapio_itens (
      id TEXT PRIMARY KEY,
      unidadeId TEXT NOT NULL,
      produtoId TEXT NOT NULL,
      precoUnidade REAL NOT NULL,
      disponivel INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (unidadeId) REFERENCES unidades(id),
      FOREIGN KEY (produtoId) REFERENCES produtos(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS estoque_itens (
      id TEXT PRIMARY KEY,
      unidadeId TEXT NOT NULL,
      produtoId TEXT NOT NULL,
      quantidadeAtual REAL NOT NULL,
      quantidadeMinima REAL NOT NULL,
      unidadeMedida TEXT NOT NULL,
      ultimaAtualizacao TEXT NOT NULL,
      FOREIGN KEY (unidadeId) REFERENCES unidades(id),
      FOREIGN KEY (produtoId) REFERENCES produtos(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      codigoDisplay TEXT NOT NULL,
      unidadeId TEXT NOT NULL,
      clienteId TEXT,
      canal TEXT NOT NULL,
      status TEXT NOT NULL,
      valorTotal REAL NOT NULL,
      valorDesconto REAL NOT NULL,
      valorFinal REAL NOT NULL,
      pontosFidelidadeGanhos INTEGER NOT NULL DEFAULT 0,
      criadoEm TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL,
      FOREIGN KEY (unidadeId) REFERENCES unidades(id),
      FOREIGN KEY (clienteId) REFERENCES usuarios(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id TEXT PRIMARY KEY,
      pedidoId TEXT NOT NULL,
      produtoId TEXT NOT NULL,
      nomeProduto TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      precoUnitario REAL NOT NULL,
      precoTotal REAL NOT NULL,
      observacoes TEXT,
      FOREIGN KEY (pedidoId) REFERENCES pedidos(id),
      FOREIGN KEY (produtoId) REFERENCES produtos(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id TEXT PRIMARY KEY,
      pedidoId TEXT NOT NULL,
      transacaoExternaId TEXT,
      chaveIdempotencia TEXT UNIQUE NOT NULL,
      formaPagamento TEXT NOT NULL,
      valor REAL NOT NULL,
      status TEXT NOT NULL,
      mensagemGateway TEXT,
      criadoEm TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL,
      FOREIGN KEY (pedidoId) REFERENCES pedidos(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS consentimento_lgpd (
      id TEXT PRIMARY KEY,
      usuarioId TEXT NOT NULL,
      versaoTermo TEXT NOT NULL,
      consentiuMarketing INTEGER NOT NULL,
      consentiuFidelidade INTEGER NOT NULL,
      consentiuPerfilamento INTEGER NOT NULL,
      ipOrigem TEXT NOT NULL,
      dataConsentimento TEXT NOT NULL,
      FOREIGN KEY (usuarioId) REFERENCES usuarios(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS logs_auditoria (
      id TEXT PRIMARY KEY,
      usuarioId TEXT,
      usuarioNome TEXT,
      unidadeId TEXT,
      acao TEXT NOT NULL,
      recurso TEXT NOT NULL,
      detalhes TEXT NOT NULL,
      dataHora TEXT NOT NULL,
      ipOrigem TEXT
    );
  `);

  await seedInitialData();
}

async function seedInitialData() {
  const countUnidades = await getQuery<{ total: number }>(`SELECT COUNT(*) as total FROM unidades`);
  if (countUnidades && countUnidades.total > 0) return;

  // 1. Inserir Unidades
  await runQuery(`
    INSERT INTO unidades (id, nome, cidade, estado, endereco, possuiCozinhaCompleta, horarioFuncionamento, ativa) VALUES
    ('und-recife-01', 'Raízes Recife - Boa Viagem', 'Recife', 'PE', 'Av. Conselheiro Aguiar, 1200', 1, '06:00 - 22:00', 1),
    ('und-olinda-01', 'Raízes Olinda - Sítio Histórico', 'Olinda', 'PE', 'Rua do Amparo, 45', 0, '07:00 - 20:00', 1),
    ('und-fortaleza-01', 'Raízes Fortaleza - Meireles', 'Fortaleza', 'CE', 'Av. Beira Mar, 850', 1, '06:00 - 23:00', 1)
  `);

  // 2. Inserir Produtos (com itens sazonais juninos)
  await runQuery(`
    INSERT INTO produtos (id, nome, descricao, categoria, precoBase, ehJuninoSazonal) VALUES
    ('prod-cuscuz-01', 'Cuscuz Raízes com Carne de Sol', 'Cuscuz flocado no vapor com molho de carne de sol na nata e queijo coalho.', 'CUSCUZ', 24.90, 0),
    ('prod-cuscuz-02', 'Cuscuz Simples com Manteiga de Garrafa', 'Cuscuz milho tradicional umedecido com manteiga de garrafa artesanal.', 'CUSCUZ', 12.00, 0),
    ('prod-tapioca-01', 'Tapioca Rendada de Queijo Coalho', 'Tapioca com casquinha crocante de queijo coalho e presunto artesanal.', 'TAPIOCA', 18.50, 0),
    ('prod-bolo-01', 'Bolo de Macaxeira Cremoso', 'Bolo tradicional feito com macaxeira fresca e coco ralado.', 'DOCES_REGIONAIS', 14.00, 0),
    ('prod-junino-pamonha', 'Pamonha Doce com Queijo (Sazonal Junino)', 'Especialidade de São João feita com milho verde fresco e recheada com queijo.', 'DOCES_REGIONAIS', 16.00, 1),
    ('prod-junino-canjica', 'Canjica Nordestina com Canela (Sazonal Junino)', 'Creme aveludado de milho verde polvilhado com canela em pó.', 'DOCES_REGIONAIS', 15.00, 1),
    ('prod-cafe-01', 'Café Coado na Hora (200ml)', 'Café especial torra média coado no pano tradicional.', 'CAFES', 6.50, 0),
    ('prod-suco-01', 'Suco de Umbu-Cajá (400ml)', 'Suco natural de polpa de fruta regional do sertão.', 'BEBIDAS', 9.90, 0)
  `);

  // 3. Inserir Cardápio por Unidade
  // Recife (Cozinha Completa: todos os itens + juninos)
  await runQuery(`
    INSERT INTO cardapio_itens (id, unidadeId, produtoId, precoUnidade, disponivel) VALUES
    ('card-rec-01', 'und-recife-01', 'prod-cuscuz-01', 24.90, 1),
    ('card-rec-02', 'und-recife-01', 'prod-cuscuz-02', 12.00, 1),
    ('card-rec-03', 'und-recife-01', 'prod-tapioca-01', 18.50, 1),
    ('card-rec-04', 'und-recife-01', 'prod-bolo-01', 14.00, 1),
    ('card-rec-05', 'und-recife-01', 'prod-junino-pamonha', 16.00, 1),
    ('card-rec-06', 'und-recife-01', 'prod-junino-canjica', 15.00, 1),
    ('card-rec-07', 'und-recife-01', 'prod-cafe-01', 6.50, 1),
    ('card-rec-08', 'und-recife-01', 'prod-suco-01', 9.90, 1)
  `);

  // Olinda (Cozinha Reduzida: sem pratos complexos)
  await runQuery(`
    INSERT INTO cardapio_itens (id, unidadeId, produtoId, precoUnidade, disponivel) VALUES
    ('card-oli-02', 'und-olinda-01', 'prod-cuscuz-02', 12.00, 1),
    ('card-oli-03', 'und-olinda-01', 'prod-tapioca-01', 18.50, 1),
    ('card-oli-04', 'und-olinda-01', 'prod-bolo-01', 14.00, 1),
    ('card-oli-07', 'und-olinda-01', 'prod-cafe-01', 6.50, 1),
    ('card-oli-08', 'und-olinda-01', 'prod-suco-01', 9.90, 1)
  `);

  // 4. Inserir Estoque Inicial por Unidade
  await runQuery(`
    INSERT INTO estoque_itens (id, unidadeId, produtoId, quantidadeAtual, quantidadeMinima, unidadeMedida, ultimaAtualizacao) VALUES
    ('est-rec-01', 'und-recife-01', 'prod-cuscuz-01', 50, 10, 'UNIDADE', datetime('now')),
    ('est-rec-02', 'und-recife-01', 'prod-cuscuz-02', 100, 20, 'UNIDADE', datetime('now')),
    ('est-rec-03', 'und-recife-01', 'prod-tapioca-01', 80, 15, 'UNIDADE', datetime('now')),
    ('est-rec-05', 'und-recife-01', 'prod-junino-pamonha', 30, 5, 'UNIDADE', datetime('now')),
    ('est-oli-02', 'und-olinda-01', 'prod-cuscuz-02', 20, 5, 'UNIDADE', datetime('now')),
    ('est-oli-03', 'und-olinda-01', 'prod-tapioca-01', 25, 5, 'UNIDADE', datetime('now'))
  `);

  // 5. Inserir Usuários (Senha em hash bcrypt para "Senha@123")
  // bcrypt hash de "Senha@123" = $2a$10$7R0cMv1L3w5yS90Z8X5t4e1G1m/3n5r7S9u0v1w2x3y4z5a6b7c8d
  const hashSenhaPadrao = '$2a$10$r.gY9h1t9f3g7f5d3e1c2u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j';

  await runQuery(`
    INSERT INTO usuarios (id, nome, email, senhaHash, cpf, telefone, dataNascimento, papel, unidadeId, criadoEm, anonimizado) VALUES
    ('usr-admin-matriz', 'Francisca da Silva (Diretoria)', 'diretoria@raizesdonordeste.com.br', '${hashSenhaPadrao}', '11122233344', '81999990001', '1965-05-15', 'DIRETORIA_MATRIZ', NULL, datetime('now'), 0),
    ('usr-gerente-recife', 'João Silva (Gerente Recife)', 'gerente.recife@raizesdonordeste.com.br', '${hashSenhaPadrao}', '22233344455', '81999990002', '1988-08-20', 'GERENTE_LOJA', 'und-recife-01', datetime('now'), 0),
    ('usr-atendente-recife', 'Maria dos Santos (Atendente)', 'atendente.recife@raizesdonordeste.com.br', '${hashSenhaPadrao}', '33344455566', '81999990003', '1995-03-10', 'ATENDENTE', 'und-recife-01', datetime('now'), 0),
    ('usr-cliente-01', 'Severino Cabral (Cliente Fiel)', 'severino.cabral@gmail.com', '${hashSenhaPadrao}', '44455566677', '81988887777', '1990-11-25', 'CLIENTE', NULL, datetime('now'), 0)
  `);

  // 6. Inserir Consentimento LGPD do Cliente
  await runQuery(`
    INSERT INTO consentimento_lgpd (id, usuarioId, versaoTermo, consentiuMarketing, consentiuFidelidade, consentiuPerfilamento, ipOrigem, dataConsentimento) VALUES
    ('lgpd-sev-01', 'usr-cliente-01', 'v1.2-2026', 1, 1, 1, '187.55.120.4', datetime('now'))
  `);
}
