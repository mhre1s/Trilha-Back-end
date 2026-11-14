export enum UserRole {
  CLIENTE = 'CLIENTE',
  ATENDENTE = 'ATENDENTE',
  GERENTE_LOJA = 'GERENTE_LOJA',
  DIRETORIA_MATRIZ = 'DIRETORIA_MATRIZ'
}

export enum CanalPedido {
  APP_OFICIAL = 'APP_OFICIAL',
  TOTEM_AUTOATENDIMENTO = 'TOTEM_AUTOATENDIMENTO',
  BALCAO_ATENDIMENTO = 'BALCAO_ATENDIMENTO',
  PICKUP_RETIRADA = 'PICKUP_RETIRADA'
}

export enum StatusPedido {
  CRIADO = 'CRIADO',
  AGUARDANDO_PAGAMENTO = 'AGUARDANDO_PAGAMENTO',
  PAGO = 'PAGO',
  EM_PREPARACAO = 'EM_PREPARACAO',
  PRONTO_PARA_RETIRADA = 'PRONTO_PARA_RETIRADA',
  ENTREGUE = 'ENTREGUE',
  CANCELADO = 'CANCELADO'
}

export enum StatusPagamento {
  PENDENTE = 'PENDENTE',
  APROVADO = 'APROVADO',
  REJEITADO = 'REJEITADO',
  ESTORNADO = 'ESTORNADO'
}

export enum FormaPagamento {
  PIX = 'PIX',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
  CARTAO_DEBITO = 'CARTAO_DEBITO',
  VALE_REFEICAO = 'VALE_REFEICAO'
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  cpf?: string;
  telefone?: string;
  dataNascimento?: string;
  papel: UserRole;
  unidadeId?: string; // nulo se for MATRIZ ou CLIENTE global
  criadoEm: string;
  anonimizado: boolean;
}

export interface Unidade {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  endereco: string;
  possuiCozinhaCompleta: boolean;
  horarioFuncionamento: string;
  ativa: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  categoria: 'CUSCUZ' | 'TAPIOCA' | 'BEBIDAS' | 'DOCES_REGIONAIS' | 'CAFES' | 'COMBOS';
  precoBase: number;
  ehJuninoSazonal: boolean;
  imagemUrl?: string;
}

export interface CardapioItem {
  id: string;
  unidadeId: string;
  produtoId: string;
  precoUnidade: number;
  disponivel: boolean;
}

export interface EstoqueItem {
  id: string;
  unidadeId: string;
  produtoId: string;
  quantidadeAtual: number;
  quantidadeMinima: number;
  unidadeMedida: 'UNIDADE' | 'KG' | 'LITRO';
  ultimaAtualizacao: string;
}

export interface ItemPedidoInput {
  produtoId: string;
  quantidade: number;
  observacoes?: string;
}

export interface Pedido {
  id: string;
  codigoDisplay: string;
  unidadeId: string;
  clienteId?: string;
  canal: CanalPedido;
  status: StatusPedido;
  valorTotal: number;
  valorDesconto: number;
  valorFinal: number;
  pontosFidelidadeGanhos: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ItemPedido {
  id: string;
  pedidoId: string;
  produtoId: string;
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  observacoes?: string;
}

export interface Pagamento {
  id: string;
  pedidoId: string;
  transacaoExternaId?: string;
  chaveIdempotencia: string;
  formaPagamento: FormaPagamento;
  valor: number;
  status: StatusPagamento;
  mensagemGateway?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ConsentimentoLGPD {
  id: string;
  usuarioId: string;
  versaoTermo: string;
  consentiuMarketing: boolean;
  consentiuFidelidade: boolean;
  consentiuPerfilamento: boolean;
  ipOrigem: string;
  dataConsentimento: string;
}

export interface LogAuditoria {
  id: string;
  usuarioId?: string;
  usuarioNome?: string;
  unidadeId?: string;
  acao: string; // EX: 'CANCELAMENTO_PEDIDO', 'DESCONTO_MANUAL', 'ANONIMIZACAO_LGPD', 'AJUSTE_ESTOQUE'
  recurso: string;
  detalhes: string;
  dataHora: string;
  ipOrigem?: string;
}

export interface ExtratoFidelidade {
  clienteId: string;
  pontosAcumulados: number;
  nivelCliente: 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';
  percentualDesconto: number;
  historico: Array<{
    data: string;
    descricao: string;
    pontos: number;
    tipo: 'GANHO' | 'RESGATE';
  }>;
}
