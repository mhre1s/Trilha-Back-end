# Rede Raízes do Nordeste — API Back-end
**Projeto Multidisciplinar — Trilha Back-end (UNINTER)**

Este repositório contém a API REST completa desenvolvida para a rede de lanchonetes **Raízes do Nordeste**, atendendo aos requisitos de arquitetura em camadas, suporte a múltiplos canais de venda (`canalPedido`), gestão descentralizada de unidades e estoque, integração com gateway de pagamento mock (idempotente) e conformidade técnica com a LGPD.

---

## 1. Requisitos do Ambiente
- **Node.js**: Versão 18 LTS ou superior (recomendado: Node.js 20/22/24)
- **Gerenciador de Pacotes**: npm (versão 9+)
- **Banco de Dados**: SQLite3 (embarcado, zero-configuração de servidor externo)

---

## 2. Configuração de Variáveis de Ambiente
Crie um arquivo `.env` na raiz da pasta `backend` com base no arquivo `.env.example`:

```bash
cp .env.example .env
```

Conteúdo padrão do `.env`:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=raizes_do_nordeste_secret_key_2026_multidisciplinar
```

---

## 3. Instalação de Dependências
Execute o comando abaixo na pasta `backend`:

```bash
npm install
```

---

## 4. Inicialização do Banco de Dados e Seed
O sistema utiliza SQLite3 com criação automática de tabelas (DDL) e carga de dados iniciais (*seed*) na primeira execução do servidor:
- **Unidades cadastradas**: Recife (cozinha completa), Olinda (cozinha reduzida), Fortaleza.
- **Cardápio e Estoque**: Produtos típicos e sazonais juninos (Pamonha Doce, Canjica, Cuscuz, etc.).
- **Usuários semente**:
  - Diretoria: `diretoria@raizesdonordeste.com.br` | Senha: `Senha@123`
  - Gerente Recife: `gerente.recife@raizesdonordeste.com.br` | Senha: `Senha@123`
  - Atendente: `atendente.recife@raizesdonordeste.com.br` | Senha: `Senha@123`
  - Cliente Fiel: `severino.cabral@gmail.com` | Senha: `Senha@123`

---

## 5. Como Iniciar a API
### Modo de Desenvolvimento (com auto-reload):
```bash
npm run dev
```

### Modo de Produção:
```bash
npm run build
npm start
```
A API estará acessível em: `http://localhost:3000/api/v1`

---

## 6. Documentação Interativa da API (Swagger / OpenAPI)
Com o servidor rodando, acesse a documentação interativa pelo navegador:
- **URL Local**: `http://localhost:3000/api-docs`

---

## 7. Execução dos Testes Automatizados (Jest)
A suíte de testes de integração automatizada cobre autenticação JWT, controle de acesso RBAC, validação de estoque, idempotência de webhooks e anonimização LGPD:

```bash
npm test
```
*Total de testes: 10 cenários (100% de aprovação).*

---

## 8. Coleção Postman / Insomnia
O arquivo da coleção de requisições está localizado na raiz deste repositório:
- **Arquivo**: `Raizes_do_Nordeste_Postman_Collection.json`

### Ordem sugerida para execução no Postman:
1. `01. Autenticação > Login - Diretoria Matriz` (obtém o token JWT)
2. `02. Cardápio e Unidades > Consultar Cardápio de Recife`
3. `03. Gestão de Pedidos > Criar Pedido via Totem` (gera o pedido com `canalPedido: TOTEM_AUTOATENDIMENTO`)
4. `04. Pagamento Desacoplado > Solicitar Pagamento via PIX` (gera a chave de idempotência)
5. `04. Pagamento Desacoplado > Webhook de Confirmação (Idempotente)` (confirma e testa envio repetido)
6. `05. Conformidade LGPD > Exportar Meus Dados` e `Anonimizar Minha Conta`

---

## 9. Estrutura do Projeto (Arquitetura em Camadas)
```
src/
├── app.ts                 # Configuração do Express, CORS e Swagger UI
├── server.ts              # Inicialização do servidor HTTP e conexão SQLite
├── swagger.ts             # Especificação OpenAPI 3.0
├── config/
│   └── database.ts        # Conexão SQLite3, migrations DDL e seed inicial
├── middleware/
│   ├── auth.ts            # Validação de JWT e RBAC (roles)
│   └── errorHandler.ts    # Tratamento centralizado de erros e respostas padronizadas
├── models/
│   └── types.ts           # Definição de interfaces, DTOs e ENUMs (Domain)
├── controllers/           # Application / Interface Controllers
│   ├── AuthController.ts
│   ├── CardapioController.ts
│   ├── PedidoController.ts
│   ├── PagamentoController.ts
│   ├── EstoqueController.ts
│   ├── MatrizController.ts
│   ├── LgpdController.ts
│   └── FidelizacaoController.ts
└── routes/
    └── index.ts           # Mapeamento de rotas REST
```
