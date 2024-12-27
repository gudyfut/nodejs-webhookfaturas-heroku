const express = require('express');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// Configuração do Fixie Socks
const FIXIE_URL = process.env.FIXIE_URL || 'socks5://fixie:3OOvtNtIwYDP5xU@speedway.usefixie.com:1080';
const proxyAgent = new SocksProxyAgent(FIXIE_URL);

// Função para realizar chamadas à API do WHMCS
async function whmcsApiCall(action, params) {
    const apiUrl = 'https://financeiro.goldenrastreamento.com.br/includes/api.php';

    // Adiciona os parâmetros necessários
    params.action = action; // Adiciona explicitamente o action
    params.identifier = 'Lr6XJANaE52RUiNVuUftxh4ztnBEsNUp';
    params.secret = 'pVN02V3s7w8Kt4WwQ2jxHP6AInFAnisq';
    params.responsetype = 'json';

    try {
        const response = await axios.post(apiUrl, new URLSearchParams(params), {
            httpsAgent: proxyAgent,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded', // Cabeçalho correto
                'User-Agent': 'nodejs-webhookfaturas-heroku', // Identificação opcional
            },
        });
        console.log('Resposta da API do WHMCS:', response.data);
        return response.data;
    } catch (error) {
        console.error('Erro ao comunicar com o WHMCS:', error.message);
        if (error.response) {
            console.error('Detalhes do erro:', {
                status: error.response.status,
                headers: error.response.headers,
                data: error.response.data,
            });
        }
        throw error;
    }
}

// Endpoint para retornar a quantidade de faturas e as faturas do cliente com base no email
app.get('/get-invoices', async (req, res) => {
    const { email } = req.query; // Recebe o e-mail do cliente

    try {
        // Busca o cliente pelo e-mail no WHMCS
        const clientResponse = await whmcsApiCall('GetClientsDetails', { email });
        if (clientResponse.result === 'success' && clientResponse.userid) {
            const clientId = clientResponse.userid; // ID do cliente retornado diretamente

            // Busca as faturas do cliente com status "Overdue"
            const overdueInvoicesResponse = await whmcsApiCall('GetInvoices', { userid: clientId, status: "Overdue" });
            let overdueInvoicesQnt = overdueInvoicesResponse.invoices ? overdueInvoicesResponse.invoices.length : 0;

            // Busca as faturas do cliente com status "Unpaid"
            const unpaidInvoicesResponse = await whmcsApiCall('GetInvoices', { userid: clientId, status: "Unpaid" });
            const unpaidInvoicesQnt = unpaidInvoicesResponse.invoices ? unpaidInvoicesResponse.invoices.length : 0;

            // Pega o id da primeira fatura Unpaid
            const invoiceId = unpaidInvoicesResponse.invoices[0]?.id;

            // Faz o link do invoice
            const invoiceLink = `https://financeiro.goldenrastreamento.com.br/viewinvoice.php?id=${invoiceId}`;

            res.json({
                clientfound: 1,
                overdues: overdueInvoicesQnt,
                quantity: unpaidInvoicesQnt,
                invoiceLink: invoiceLink,
                invoices: unpaidInvoicesResponse.invoices,
            });
        } else {
            res.json({ clientfound: 0 });
        }
    } catch (error) {
        res.status(500).send('Erro no servidor');
    }
});

// Testa o proxy
app.get('/test-proxy', async (req, res) => {
    try {
        const response = await axios.get('https://httpbin.org/ip', {
            httpsAgent: proxyAgent,
        });
        res.json({ proxyIp: response.data });
    } catch (error) {
        res.status(500).send('Erro ao testar o proxy');
    }
});

// Inicia o servidor na porta disponibilizada ou 3000
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
