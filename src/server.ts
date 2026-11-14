import { app } from './app';
import { initDatabase } from './config/database';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 API Raízes do Nordeste iniciada com sucesso!`);
      console.log(`📍 Servidor ativo em: http://localhost:${PORT}/api/v1`);
      console.log(`📚 Documentação Swagger: http://localhost:${PORT}/api-docs`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('❌ Falha ao inicializar o banco de dados:', error);
    process.exit(1);
  }
}

bootstrap();
