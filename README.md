# Sistema de Agendamento de Entregas

Sistema completo para agendamento de entregas de fornecedores em depósitos.

## Funcionalidades

- **Fornecedores**: Cadastro, login e agendamento de entregas
- **Administrador**: Gerenciamento de horários disponíveis e visualização de agendamentos
- **Histórico**: Mantém registro dos últimos 60 dias
- **Restrições**: 
  - Não permite agendar horários passados
  - Limite de 1 agendamento por dia por fornecedor

## Instalação em Servidor Interno

### Pré-requisitos

- Node.js 18+ instalado
- MySQL 8.0 instalado e rodando
- npm ou yarn

### Passo 1: Instalar Dependências

```bash
cd agendamento-entregas
npm install
```

### Passo 2: Configurar Banco de Dados MySQL

Crie um banco de dados no MySQL:

```sql
CREATE DATABASE agendamento_entregas;
CREATE USER 'agendamento'@'localhost' IDENTIFIED BY 'sua-senha-aqui';
GRANT ALL PRIVILEGES ON agendamento_entregas.* TO 'agendamento'@'localhost';
FLUSH PRIVILEGES;
```

### Passo 3: Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
DATABASE_URL=mysql://agendamento:sua-senha-aqui@localhost:3306/agendamento_entregas
PORT=3000
JWT_SECRET=gerar-uma-senha-secreta-longa-e-aleatoria-aqui
```

**IMPORTANTE**: 
- Substitua `sua-senha-aqui` pela senha real do banco
- Gere uma `JWT_SECRET` longa e aleatória (ex: `minha-senha-super-secreta-123456789`)
- Ajuste `PORT` se necessário

### Passo 4: Iniciar o Servidor

```bash
npm start
```

O servidor irá:
1. Conectar ao banco de dados
2. Criar as tabelas automaticamente
3. Criar o usuário admin padrão
4. Iniciar na porta configurada

### Passo 5: Acessar o Sistema

Abra o navegador e acesse:
```
http://localhost:3000
```

Ou, se estiver acessando de outra máquina na rede:
```
http://IP-DO-SERVIDOR:3000
```

### Login Inicial

- **Email**: `admin@agendamento.com`
- **Senha**: `admin123`

**IMPORTANTE**: Após o primeiro acesso, altere a senha do administrador!

## Rodando em Background (Linux/Mac)

Para manter o servidor rodando mesmo após fechar o terminal:

### Opção 1: PM2 (Recomendado)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar o servidor
pm2 start server.js --name agendamento

# Configurar para iniciar automaticamente
pm2 startup
pm2 save
```

Comandos úteis:
```bash
pm2 status              # Ver status
pm2 logs agendamento    # Ver logs
pm2 restart agendamento # Reiniciar
pm2 stop agendamento    # Parar
```

### Opção 2: nohup (Simples)

```bash
nohup npm start > agendamento.log 2>&1 &
```

Para parar:
```bash
pkill -f "node server.js"
```

## Rodando como Serviço (systemd - Linux)

Crie um arquivo de serviço:

```bash
sudo nano /etc/systemd/system/agendamento.service
```

Conteúdo:

```ini
[Unit]
Description=Agendamento de Entregas
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/caminho/para/agendamento-entregas
ExecStart=/usr/bin/node /caminho/para/agendamento-entregas/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Ativar e iniciar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable agendamento
sudo systemctl start agendamento
sudo systemctl status agendamento
```

## Acesso Externo (Opcional)

Se precisar acessar de fora da rede interna:

### Configurar Firewall

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 3000/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### Usar Nginx como Proxy Reverso (Recomendado para Produção)

Instale e configure o Nginx:

```bash
sudo apt install nginx
```

Crie a configuração:

```bash
sudo nano /etc/nginx/sites-available/agendamento
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name agendamento.suaempresa.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative o site:

```bash
sudo ln -s /etc/nginx/sites-available/agendamento /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Certificado SSL (HTTPS)

Use Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d agendamento.suaempresa.com
```

## Backup do Banco de Dados

Faça backups regulares:

```bash
# Backup manual
mysqldump -u agendamento -p agendamento_entregas > backup_$(date +%Y%m%d_%H%M%S).sql

# Script de backup automático (backup.sh)
#!/bin/bash
BACKUP_DIR="/backups/agendamento"
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u agendamento -p'SUA-SENHA' agendamento_entregas > $BACKUP_DIR/backup_$DATE.sql
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete

# Adicionar no crontab (backup diário às 2h)
crontab -e
0 2 * * * /caminho/para/backup.sh
```

## Estrutura do Projeto

```
agendamento-entregas/
├── server.js              # Backend Node.js + Express
├── package.json           # Dependências
├── .env                   # Variáveis de ambiente (criar)
├── .env.example          # Exemplo de configuração
└── public/
    └── index.html         # Frontend (SPA)
```

## Tecnologias

- **Backend**: Node.js + Express
- **Banco**: MySQL 8.0
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla
- **Autenticação**: JWT (JSON Web Token)

## Solução de Problemas

### Erro: "Cannot connect to MySQL"
- Verifique se o MySQL está rodando: `sudo systemctl status mysql`
- Confirme as credenciais no arquivo `.env`
- Teste a conexão manualmente: `mysql -u agendamento -p agendamento_entregas`

### Erro: "Port 3000 already in use"
- Mude a porta no arquivo `.env`
- Ou pare o processo que está usando a porta: `sudo lsof -i :3000`

### Site não carrega
- Verifique os logs: `pm2 logs` ou `journalctl -u agendamento`
- Confirme que o firewall está liberando a porta
- Teste localmente: `curl http://localhost:3000`

### Esqueci a senha do admin
Acesse o banco de dados e resete:

```sql
USE agendamento_entregas;
-- Senha "admin123" em base64: YWRtaW4xMjM=
UPDATE users SET password_hash='YWRtaW4xMjM=' WHERE email='admin@agendamento.com';
```

## Suporte

Para dúvidas ou problemas, verifique:
1. Os logs do servidor (`pm2 logs` ou `journalctl -u agendamento`)
2. Os logs do MySQL (`/var/log/mysql/error.log`)
3. As permissões dos arquivos e diretórios
