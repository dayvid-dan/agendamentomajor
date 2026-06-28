# Guia de Deploy - Railway

## Passo a Passo Completo

### 1. Preparar o Repositório GitHub

1. Acesse https://github.com e crie um novo repositório (ex: `agendamento-entregas`)
2. Faça upload dos arquivos:
   - `server.js`
   - `package.json`
   - `public/index.html`
   - `README.md`
3. Commit e push

### 2. Configurar no Railway

#### 2.1 Criar Serviço Node.js

1. Acesse https://railway.app e entre no seu projeto
2. Clique em **"+ New"** no canto superior direito
3. Selecione **"GitHub Repo"**
4. Escolha o repositório `agendamento-entregas` que você criou
5. Aguarde o deploy inicial (pode falhar por falta de variáveis, é normal)

#### 2.2 Configurar Variáveis de Ambiente

1. Clique no serviço **Node.js** criado
2. Vá na aba **"Variables"**
3. Clique em **"+ New Variable"**
4. Adicione estas variáveis:

**Variável 1: DATABASE_URL**
- Clique no ícone de referência (+) ao lado do valor
- Selecione o serviço **MySQL**
- Escolha **"MySQL Internal URL"** ou **"MYSQL_URL"**
- O Railway vai preencher automaticamente algo como:
  ```
  mysql://root:abc123@mysql.railway.internal:3306/railway
  ```

**Variável 2: PORT**
- Nome: `PORT`
- Valor: `8080`

**Variável 3: JWT_SECRET** (opcional, mas recomendado)
- Nome: `JWT_SECRET`
- Valor: Qualquer string longa e aleatória (ex: `minha-senha-secreta-super-segura-123`)

#### 2.3 Configurar Porta e Domain

1. Vá na aba **"Settings"** do serviço Node.js
2. Em **"Networking"**:
   - Clique em **"Generate Domain"**
   - O Railway criará uma URL pública tipo: `agendamento-entregas.up.railway.app`

3. Em **"Deploy"** (se necessário):
   - Start Command: `npm start`
   - O Railway detecta automaticamente, mas se precisar mudar, configure aqui

#### 2.4 Verificar Deploy

1. Volte para a aba **"Deployments"**
2. Aguarde o status ficar **"Deployed"** (bolinha verde)
3. Se houver erro, clique no deploy para ver os logs
4. Clique na URL gerada para acessar o sistema

### 3. Testar o Sistema

1. Acesse a URL gerada pelo Railway
2. Faça login com:
   - **Email**: `admin@agendamento.com`
   - **Senha**: `admin123`
3. Teste criando alguns horários
4. Faça logout e teste o cadastro de fornecedor
5. Faça login como fornecedor e teste o agendamento

### 4. Solução de Problemas

#### Erro: "DATABASE_URL não configurada"
- Verifique se a variável DATABASE_URL está configurada corretamente
- Use a **Internal URL** do MySQL, não a Public URL
- Reinicie o deploy após adicionar a variável

#### Erro: "Cannot connect to MySQL"
- Verifique se o serviço MySQL está rodando
- Confirme que o banco de dados foi inicializado
- Tente reiniciar ambos os serviços (MySQL e Node.js)

#### Site não carrega
- Verifique se o domínio foi gerado em Settings > Networking
- Aguarde alguns minutos após o deploy (DNS pode demorar)
- Verifique os logs do deploy para erros

### 5. Atualizações

Para atualizar o sistema:

1. Faça alterações nos arquivos localmente
2. Commit e push para o GitHub
3. O Railway detecta automaticamente e faz novo deploy

### 6. Monitoramento

- **Logs**: Aba "Deployments" > clique no deploy > aba "Logs"
- **Uso**: Aba "Usage" para ver consumo de recursos
- **Banco**: Use ferramentas como TablePlus ou DBeaver conectando via Public URL do MySQL

---

## Resumo Rápido

```
1. Push no GitHub
2. Conectar repo no Railway
3. Adicionar DATABASE_URL (MySQL Internal URL)
4. Adicionar PORT=8080
5. Gerar Domain
6. Acessar e testar
```

**Login Admin:**
- Email: `admin@agendamento.com`
- Senha: `admin123`
