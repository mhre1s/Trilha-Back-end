export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'API REST — Rede Raízes do Nordeste',
    version: '1.0.0',
    description: 'Documentação da API Back-end para gestão omnicanal, cardápios regionais, estoque descentralizado, pagamentos desacoplados e conformidade LGPD.'
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Servidor Local de Desenvolvimento e Demonstração Prática'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Healthcheck da API',
        responses: {
          '200': { description: 'API em funcionamento normal' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Autenticação de Usuário (JWT)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'diretoria@raizesdonordeste.com.br' },
                  senha: { type: 'string', example: 'Senha@123' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Autenticado com sucesso, retorna Token JWT.' },
          '401': { description: 'Credenciais inválidas' }
        }
      }
    },
    '/unidades': {
      get: {
        summary: 'Listar todas as unidades da franquia',
        responses: {
          '200': { description: 'Lista de unidades com tipo de cozinha e localização' }
        }
      }
    },
    '/unidades/{id}/cardapio': {
      get: {
        summary: 'Consultar cardápio específico de uma unidade (com itens juninos e controle local)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Cardápio filtrado com disponibilidade e estoque' }
        }
      }
    },
    '/pedidos': {
      post: {
        summary: 'Criar pedido (Omnicanal: App, Totem, Balcão, Pick-up)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  unidadeId: { type: 'string', example: 'und-recife-01' },
                  canal: { type: 'string', example: 'TOTEM_AUTOATENDIMENTO' },
                  itens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        produtoId: { type: 'string', example: 'prod-cuscuz-01' },
                        quantidade: { type: 'integer', example: 2 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Pedido criado e estoque reservado' }
        }
      }
    },
    '/pagamentos/solicitar': {
      post: {
        summary: 'Solicitar pagamento a gateway externo com chave de idempotência',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pedidoId: { type: 'string' },
                  formaPagamento: { type: 'string', example: 'PIX' },
                  chaveIdempotencia: { type: 'string', example: 'idemp-tx-999888' }
                }
              }
            }
          }
        },
        responses: {
          '202': { description: 'Pagamento solicitado e aguardando webhook' }
        }
      }
    },
    '/webhooks/pagamentos': {
      post: {
        summary: 'Webhook idempotente para confirmação de pagamento do gateway',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  chaveIdempotencia: { type: 'string' },
                  transacaoExternaId: { type: 'string' },
                  statusGateway: { type: 'string', example: 'SUCCESS' },
                  valor: { type: 'number' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Notificação processada com idempotência mantida' }
        }
      }
    },
    '/lgpd/anonimizar': {
      post: {
        summary: 'Anonimização de dados do titular (Direito ao Esquecimento - Art. 18 LGPD)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Dados anonimizados e conta desativada com sucesso' }
        }
      }
    }
  }
};
