const express = require('express');
const axios = require('axios');
const SocksProxyAgent = require('socks-proxy-agent');
const url = require('url');
const WHMCS = require('node-whmcs'); // Se usar a biblioteca.

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// Parse a variável FIXIE_SOCKS_HOST
const fixieUrl = process.env.FIXIE_SOCKS_HOST;
const fixieParsed = new url.URL(`socks://${fixieUrl}`);
const proxyAgent = new SocksProxyAgent({
  hostname: fixieParsed.hostname, // Hostname do proxy
  port: fixieParsed.port,         // Porta do proxy
  username: fixieParsed.username, // Usuário do proxy
  password: fixieParsed.password, // Senha do proxy
});

// Configurações do WHMCS
const config = {
    host: 'financeiro.goldenrastreamento.com.br', // alterei para o sistema em produção
    identifier: 'Lr6XJANaE52RUiNVuUftxh4ztnBEsNUp',
    secret: 'pVN02V3s7w8Kt4WwQ2jxHP6AInFAnisq',
    serverUrl: 'localhost',
    userAgent: 'boot',
};
const wclient = new WHMCS(config);

// Endpoint para retornar a quantidade de faturas e as faturas do cliente com base no email
app.get('/get-invoices', async (req, res) => {
    const { email } = req.query; // Recebe o e-mail do cliente

    try {
        // Busca o cliente pelo e-mail no WHMCS
        const clientResponse = await axios.get(`https://${config.host}/api.php?action=GetClientsDetails&email=${email}`, {
            httpsAgent: proxyAgent,
        });

        if (clientResponse.data.result === 'success' && clientResponse.data.userid) {
            const clientId = clientResponse.data.userid; // ID do cliente retornado diretamente
            console.log(`Cliente encontrado: ${clientId}`);

            // Busca as faturas do cliente com status "Overdue"
            const overdueInvoicesResponse = await axios.get(`https://${config.host}/api.php?action=GetInvoices&userid=${clientId}&status=Overdue`, {
                httpsAgent: proxyAgent,
            });
            const overdueInvoices = overdueInvoicesResponse.data.invoices || [];
            const overdueInvoicesQnt = overdueInvoices.length;

            // Busca as faturas do cliente com status "Unpaid"
            const unpaidInvoicesResponse = await axios.get(`https://${config.host}/api.php?action=GetInvoices&userid=${clientId}&status=Unpaid`, {
                httpsAgent: proxyAgent,
            });
            const unpaidInvoices = unpaidInvoicesResponse.data.invoices || [];
            const unpaidInvoicesQnt = unpaidInvoices.length;

            // Pega o id da primeira fatura Unpaid, se existir
            const invoiceId = unpaidInvoices.length > 0 ? unpaidInvoices[0].id : null;

            // Faz o link do invoice
            const invoiceLink = invoiceId
                ? `https://financeiro.goldenrastreamento.com.br/viewinvoice.php?id=${invoiceId}`
                : null;

            if (overdueInvoicesQnt > 0) {
                console.log(`Faturas Overdue encontradas: ${overdueInvoicesQnt}`);
                res.json({
                    clientfound: 1,
                    overdues: overdueInvoicesQnt,
                    quantity: unpaidInvoicesQnt,
                    invoiceLink: invoiceLink,
                    invoices: unpaidInvoices,
                });
            } else {
                console.log('Nenhuma fatura Overdue encontrada');
                res.json({
                    clientfound: 1,
                    overdues: 0,
                    quantity: unpaidInvoicesQnt,
                    invoiceLink: invoiceLink,
                    invoices: unpaidInvoices,
                });
            }
        } else {
            console.error('Cliente não encontrado ou erro na busca:', clientResponse.data.message);
            res.json({ clientfound: 0 });
        }
    } catch (error) {
        console.error('Erro ao comunicar com o WHMCS:', error.message);
        res.status(500).send('Erro no servidor');
    }
});

// Endpoint para testar o IP de saída
app.get('/test-ip', async (req, res) => {
    try {
        const response = await axios.get('https://httpbin.org/ip', {
            httpsAgent: proxyAgent,
        });
        res.json({ ip: response.data });
    } catch (error) {
        console.error('Erro ao obter o IP de saída:', error.message);
        res.status(500).send('Erro ao obter o IP de saída');
    }
});

// Inicia o servidor na porta disponibilizada ou 3000
app.listen(port, () => {
    console.log('Servidor rodando');
});
