const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

let usuarios = [];

let salas = [];

let conexoesAtivas = {};

let membrosNaSala = {};

const servidor = http.createServer((req, res) => {
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

const wss = new WebSocket.Server({ server: servidor });

wss.on('connection', function (ws) {
    console.log('Novo cliente conectado!');

    ws.usuarioLogado = null;

    ws.on('message', function (mensagemRecebida) {
        let dados;
        try {
            dados = JSON.parse(mensagemRecebida);
        } catch (e) {
            console.log('Mensagem inválida recebida');
            return;
        }

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

    ws.on('close', function () {
        if (ws.usuarioLogado) {
            console.log(ws.usuarioLogado + ' desconectou');

            delete conexoesAtivas[ws.usuarioLogado];

            for (let sala in membrosNaSala) {
                membrosNaSala[sala] = membrosNaSala[sala].filter(u => u !== ws.usuarioLogado);
            }
        }
    });
});

function cadastrarUsuario(ws, dados) {
    const { username, password } = dados;

    const jaExiste = usuarios.find(u => u.username === username);

    if (jaExiste) {
        enviarParaCliente(ws, {
            tipo: 'resposta',
            acao: 'cadastrar',
            sucesso: false,
            mensagem: 'Esse usuário já existe!'
        });
        return;
    }

    usuarios.push({ username, password });
    console.log('Novo usuário cadastrado: ' + username);

    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'cadastrar',
        sucesso: true,
        mensagem: 'Cadastro realizado com sucesso!'
    });
}

function fazerLogin(ws, dados) {
    const { username, password } = dados;

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

    ws.usuarioLogado = username;
    conexoesAtivas[username] = ws;
    console.log(username + ' fez login');

    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'login',
        sucesso: true,
        mensagem: 'Login realizado com sucesso!',
        salas: salas
    });
}

function criarSala(ws, dados) {
    if (!ws.usuarioLogado) {
        enviarParaCliente(ws, { tipo: 'erro', mensagem: 'Você não está logado!' });
        return;
    }

    const nomeSala = dados.nomeSala;

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

    salas.push({ nome: nomeSala });
    membrosNaSala[nomeSala] = [];
    console.log('Sala criada: ' + nomeSala);

    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'criarSala',
        sucesso: true,
        mensagem: 'Sala "' + nomeSala + '" criada com sucesso!',
        salas: salas
    });
}

function entrarNaSala(ws, dados) {
    if (!ws.usuarioLogado) {
        enviarParaCliente(ws, { tipo: 'erro', mensagem: 'Você não está logado!' });
        return;
    }

    const nomeSala = dados.nomeSala;

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

    if (ws.salaAtual) {
        membrosNaSala[ws.salaAtual] = membrosNaSala[ws.salaAtual].filter(u => u !== ws.usuarioLogado);
    }

    ws.salaAtual = nomeSala;
    if (!membrosNaSala[nomeSala].includes(ws.usuarioLogado)) {
        membrosNaSala[nomeSala].push(ws.usuarioLogado);
    }

    console.log(ws.usuarioLogado + ' entrou na sala: ' + nomeSala);

    const membros = membrosNaSala[nomeSala];

    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'entrarSala',
        sucesso: true,
        sala: nomeSala,
        membros: membros
    });

    avisoParaSala(nomeSala, {
        tipo: 'avisoEntrada',
        mensagem: ws.usuarioLogado + ' entrou na sala!',
        membros: membros
    }, ws.usuarioLogado);
}

function enviarMensagem(ws, dados) {
    if (!ws.usuarioLogado || !ws.salaAtual) {
        enviarParaCliente(ws, { tipo: 'erro', mensagem: 'Você não está em nenhuma sala!' });
        return;
    }

    const { texto, destinatarios } = dados;
    const remetente = ws.usuarioLogado;
    const sala = ws.salaAtual;

    const mensagem = {
        tipo: 'novaMensagem',
        remetente: remetente,
        sala: sala,
        texto: texto,
        hora: new Date().toLocaleTimeString('pt-BR'),
        privada: false
    };

    if (destinatarios && destinatarios.length > 0) {
        mensagem.privada = true;
        mensagem.destinatarios = destinatarios;

        const recebeAMensagem = [remetente, ...destinatarios];

        recebeAMensagem.forEach(username => {
            if (conexoesAtivas[username]) {
                const conn = conexoesAtivas[username];
                if (conn.salaAtual === sala) {
                    enviarParaCliente(conexoesAtivas[username], mensagem);
                }
            }
        });

    } else {
        const membros = membrosNaSala[sala] || [];
        membros.forEach(username => {
            if (conexoesAtivas[username]) {
                enviarParaCliente(conexoesAtivas[username], mensagem);
            }
        });
    }
}

function listarSalas(ws) {
    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'listarSalas',
        salas: salas
    });
}

function listarMembros(ws, dados) {
    const sala = dados.sala || ws.salaAtual;
    if (!sala) return;

    enviarParaCliente(ws, {
        tipo: 'resposta',
        acao: 'listarMembros',
        membros: membrosNaSala[sala] || []
    });
}


function enviarParaCliente(ws, objeto) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(objeto));
    }
}

function avisoParaSala(nomeSala, objeto, exceto = null) {
    const membros = membrosNaSala[nomeSala] || [];
    membros.forEach(username => {
        if (username !== exceto && conexoesAtivas[username]) {
            enviarParaCliente(conexoesAtivas[username], objeto);
        }
    });
}

servidor.listen(3000, () => {
    console.log('');
    console.log('Servidor rodando em: http://localhost:3000');
    console.log('WebSocket pronto na porta 3000');
    console.log('');
});
