# 💬 SENAI TEC Chat - WebSocket

Aplicação de chat em tempo real feita com Node.js e WebSocket.

## 📋 O que foi feito

- Cadastro de usuários
- Login com usuário e senha
- Criar salas de chat
- Entrar em salas
- Enviar mensagens em tempo real para todos da sala
- Enviar mensagens privadas para membros selecionados
- Interface estilizada com HTML + CSS

---

## 🚀 Como rodar

### 1. Instalar as dependências (só na primeira vez)

```bash
npm install
```

### 2. Iniciar o servidor

```bash
node server.js
```

Vai aparecer no terminal:
```
✅ Servidor rodando em: http://localhost:3000
🔌 WebSocket pronto na porta 3000
```

### 3. Abrir no navegador

Acesse: **http://localhost:3000**

---

## 🧪 Como testar

1. Abra **duas abas** do navegador em `http://localhost:3000`
2. Em cada aba, cadastre um usuário diferente
3. Faça login em cada aba
4. Crie uma sala em uma das abas
5. Entre na mesma sala nas duas abas
6. Envie mensagens e veja chegando em tempo real!
7. Para testar mensagem privada: clique no nome de um membro antes de enviar

---

## 📁 Arquivos

- `server.js` — Servidor Node.js com WebSocket
- `index.html` — Interface do chat (frontend)
- `package.json` — Configurações do projeto Node.js

---

## ⚙️ Tecnologias usadas

- **Node.js** — Plataforma JavaScript no servidor
- **ws** — Biblioteca WebSocket para Node.js
- **HTML + CSS + JavaScript** — Frontend da aplicação
- Armazenamento **em memória** (arrays JavaScript)
