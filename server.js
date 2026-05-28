// =====================================================
// SERVIDOR DE CHAT COM WEBSOCKET
// Feito com Node.js + biblioteca 'ws'
// =====================================================

// Importa as bibliotecas necessárias
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// =====================================================
// ARMAZENAMENTO EM MEMÓRIA (como pede o requisito)
// =====================================================

// Lista de usuários cadastrados
// Cada usuário tem: { username, password }
let usuarios = [];

// Lista de salas criadas
// Cada sala tem: { nome }
let salas = [];

// Guarda as conexões ativas de cada usuário
// Chave = username, Valor = objeto WebSocket da conexão
let conexoesAtivas = {};

// Guarda quais usuários estão em qual sala
// Chave = nome da sala, Valor = lista de usernames
let membrosNaSala = {};

// =====================================================
// SERVIDOR HTTP (para servir o arquivo HTML)
// =====================================================

// Cria um servidor HTTP simples que serve o index.html
const servidor = http.createServer((req, res) => {
    // Quando alguém acessa o site, manda o arquivo index.html
    const arquivo = path.join(__dirname, 'index.html');
    fs.readFile(arquivo, (erro, conteudo) => {
        if (erro) {
            res.writeHead(500);
            res.end('Erro ao carregar a página');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(conteudo);
    });
});

// =====================================================
// SERVIDOR WEBSOCKET
// Usa o mesmo servidor HTTP (porta 3000)
// =====================================================

const wss = new WebSocket.Server({ server: servidor });

// Quando um cliente se conecta ao WebSocket...
wss.on('connection', function (ws) {
    console.log('Novo cliente conectado!');

    // Guarda o username do cliente nesta conexão
    // (começa como null, só preenchemos após o login)
    ws.usuarioLogado = null;

    // Quando receber uma mensagem deste cliente...
    ws.on('message', function (mensagemRecebida) {
        // As mensagens chegam em formato JSON (texto)
        // Precisamos converter para objeto JavaScript
        let dados;
        try {
            dados = JSON.parse(mensagemRecebida);
        } catch (e) {
            console.log('Mensagem inválida recebida');
            return;
        }

        // Verifica qual "tipo" de ação o cliente está pedindo
        // e chama a função correta
        if (dados.tipo === 'cadastrar') {
            cadastrarUsuario(ws, dados);
        } else if (dados.tipo === 'login') {
            fazerLogin(ws, dados);
        } else if (dados.tipo === 'criarSala') {
            criarSala(ws, dados);
        } else if (dados.tipo === 'entrarSala') {
            entrarNaSala(ws, dados);
        } else if (dados.tipo === 'enviarMensagem') {
            enviarMensagem(ws, dados);
        } else if (dados.tipo === 'listarSalas') {
            listarSalas(ws);
        } else if (dados.tipo === 'listarMembros') {
            listarMembros(ws, dados);
        }
    });

    // Quando o cliente desconectar...
    ws.on('close', function () {
        if (ws.usuarioLogado) {
            console.log(ws.usuarioLogado + ' desconectou');

            // Remove o usuário das conexões ativas
            delete conexoesAtivas[ws.usuarioLogado];

            // Remove o usuário de todas as salas
            for (let sala in membrosNaSala) {
                membrosNaSala[sala] = membrosNaSala[sala].filter(u => u !== ws.usuarioLogado);
            }
        }
    });
});

// =====================================================
// FUNÇÕES DE CADA AÇÃO
// =====================================================

// --- CADASTRO DE USUÁRIO ---
function cadastrarUsuario(ws, dados) {
    const { username, password } = dados;

    // Verifica se já existe um usuário com esse nome
    const jaExiste = usuarios.find(u => u.username === username);

    if (jaExiste) {
        // Manda erro para o cliente
        enviarParaCliente(ws, {
            tipo: 'resposta',
            acao: 'cadastrar',
            sucesso: false,
            mensagem: 'Esse usuário já existe!'
        });
        return;
    }

    // Se não existe, cadastra o novo usuário
    usuarios.push({ username, password });
    console.log('Novo usuário cadastrado: ' + username);

    // Avisa o cliente que deu certo
    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'cadastrar',
        sucesso: true,
        mensagem: 'Cadastro realizado com sucesso!'
    });
}

// --- LOGIN ---
function fazerLogin(ws, dados) {
    const { username, password } = dados;

    // Procura o usuário na lista
    const usuario = usuarios.find(u => u.username === username && u.password === password);

    if (!usuario) {
        enviarParaCliente(ws, {
            tipo: 'resposta',
            acao: 'login',
            sucesso: false,
            mensagem: 'Usuário ou senha incorretos!'
        });
        return;
    }

    // Login ok! Guarda o username nesta conexão
    ws.usuarioLogado = username;
    conexoesAtivas[username] = ws;
    console.log(username + ' fez login');

    // Manda a lista de salas junto com o sucesso do login
    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'login',
        sucesso: true,
        mensagem: 'Login realizado com sucesso!',
        salas: salas
    });
}

// --- CRIAR SALA ---
function criarSala(ws, dados) {
    // Verifica se o usuário está logado
    if (!ws.usuarioLogado) {
        enviarParaCliente(ws, { tipo: 'erro', mensagem: 'Você não está logado!' });
        return;
    }

    const nomeSala = dados.nomeSala;

    // Verifica se a sala já existe
    const jaExiste = salas.find(s => s.nome === nomeSala);
    if (jaExiste) {
        enviarParaCliente(ws, {
            tipo: 'resposta',
            acao: 'criarSala',
            sucesso: false,
            mensagem: 'Já existe uma sala com esse nome!'
        });
        return;
    }

    // Cria a sala
    salas.push({ nome: nomeSala });
    membrosNaSala[nomeSala] = []; // começa sem membros
    console.log('Sala criada: ' + nomeSala);

    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'criarSala',
        sucesso: true,
        mensagem: 'Sala "' + nomeSala + '" criada com sucesso!',
        salas: salas
    });
}

// --- ENTRAR NA SALA ---
function entrarNaSala(ws, dados) {
    if (!ws.usuarioLogado) {
        enviarParaCliente(ws, { tipo: 'erro', mensagem: 'Você não está logado!' });
        return;
    }

    const nomeSala = dados.nomeSala;

    // Verifica se a sala existe
    const sala = salas.find(s => s.nome === nomeSala);
    if (!sala) {
        enviarParaCliente(ws, {
            tipo: 'resposta',
            acao: 'entrarSala',
            sucesso: false,
            mensagem: 'Essa sala não existe!'
        });
        return;
    }

    // Se o usuário já estava em outra sala, remove ele de lá
    if (ws.salaAtual) {
        membrosNaSala[ws.salaAtual] = membrosNaSala[ws.salaAtual].filter(u => u !== ws.usuarioLogado);
    }

    // Adiciona o usuário à nova sala
    ws.salaAtual = nomeSala;
    if (!membrosNaSala[nomeSala].includes(ws.usuarioLogado)) {
        membrosNaSala[nomeSala].push(ws.usuarioLogado);
    }

    console.log(ws.usuarioLogado + ' entrou na sala: ' + nomeSala);

    // Lista os membros atuais da sala
    const membros = membrosNaSala[nomeSala];

    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'entrarSala',
        sucesso: true,
        sala: nomeSala,
        membros: membros
    });

    // Avisa todos na sala que alguém entrou
    avisoParaSala(nomeSala, {
        tipo: 'avisoEntrada',
        mensagem: ws.usuarioLogado + ' entrou na sala!',
        membros: membros
    }, ws.usuarioLogado);
}

// --- ENVIAR MENSAGEM ---
function enviarMensagem(ws, dados) {
    if (!ws.usuarioLogado || !ws.salaAtual) {
        enviarParaCliente(ws, { tipo: 'erro', mensagem: 'Você não está em nenhuma sala!' });
        return;
    }

    const { texto, destinatarios } = dados;
    const remetente = ws.usuarioLogado;
    const sala = ws.salaAtual;

    // Monta o objeto da mensagem
    const mensagem = {
        tipo: 'novaMensagem',
        remetente: remetente,
        sala: sala,
        texto: texto,
        hora: new Date().toLocaleTimeString('pt-BR'),
        privada: false
    };

    // Se tem destinatários selecionados = mensagem privada (filtrada)
    if (destinatarios && destinatarios.length > 0) {
        mensagem.privada = true;
        mensagem.destinatarios = destinatarios;

        // Manda só para o remetente e os destinatários escolhidos
        const recebeAMensagem = [remetente, ...destinatarios];

        recebeAMensagem.forEach(username => {
            if (conexoesAtivas[username]) {
                // Verifica se o usuário está na mesma sala
                const conn = conexoesAtivas[username];
                if (conn.salaAtual === sala) {
                    enviarParaCliente(conexoesAtivas[username], mensagem);
                }
            }
        });

    } else {
        // Sem filtro = manda para todos na sala
        const membros = membrosNaSala[sala] || [];
        membros.forEach(username => {
            if (conexoesAtivas[username]) {
                enviarParaCliente(conexoesAtivas[username], mensagem);
            }
        });
    }
}

// --- LISTAR SALAS ---
function listarSalas(ws) {
    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'listarSalas',
        salas: salas
    });
}

// --- LISTAR MEMBROS DA SALA ---
function listarMembros(ws, dados) {
    const sala = dados.sala || ws.salaAtual;
    if (!sala) return;

    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'listarMembros',
        membros: membrosNaSala[sala] || []
    });
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// Manda uma mensagem para UM cliente específico
function enviarParaCliente(ws, objeto) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(objeto));
    }
}

// Manda uma mensagem para TODOS os membros de uma sala
// (exceto o remetente, se quiser)
function avisoParaSala(nomeSala, objeto, exceto = null) {
    const membros = membrosNaSala[nomeSala] || [];
    membros.forEach(username => {
        if (username !== exceto && conexoesAtivas[username]) {
            enviarParaCliente(conexoesAtivas[username], objeto);
        }
    });
}

// =====================================================
// INICIA O SERVIDOR NA PORTA 3000
// =====================================================
servidor.listen(3000, () => {
    console.log('');
    console.log('✅ Servidor rodando em: http://localhost:3000');
    console.log('🔌 WebSocket pronto na porta 3000');
    console.log('');
});
