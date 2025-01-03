const express = require('express');
const WHMCS = require('node-whmcs');

require('dotenv').config(); // Certifique-se de ter o .env configurado

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;



// Configuração WHMCS
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
        const clientResponse = await wclient.call('GetClientsDetails', { email });
        if (clientResponse.result === 'success' && clientResponse.userid) {
            const clientId = clientResponse.userid; // ID do cliente retornado diretamente
            console.log(`Cliente encontrado: ${clientId}`);

            // Busca as faturas do cliente com status "Overdue"
            const overdueInvoicesResponse = await wclient.call('GetInvoices', { userid: clientId, status: "Overdue" });
            let overdueInvoicesQnt = overdueInvoicesResponse.length;

            // Busca as faturas do cliente com status "Unpaid"
            const unpaidInvoicesResponse = await wclient.call('GetInvoices', { userid: clientId, status: "Unpaid" });
            const unpaidInvoicesQnt = unpaidInvoicesResponse.length;

            // Pega o id da primeira fatura Unpaid
            const invoiceId = unpaidInvoicesResponse[0].id;

            // Faz o link do invoice
            const invoiceLink = `https://financeiro.goldenrastreamento.com.br/viewinvoice.php?id=${invoiceId}`;

            if (overdueInvoicesQnt > 0) {
                console.log(`Faturas Overdue encontradas: ${overdueInvoicesQnt}`);
                res.json({
                    clientfound: 1,
                    overdues: overdueInvoicesQnt,
                    quantity: unpaidInvoicesQnt,
                    invoiceLink: invoiceLink,
                    invoices: unpaidInvoicesResponse
                });
            } else {
                console.log('Nenhuma fatura Overdue encontrada');
                res.json({
                    clientfound: 1,
                    overdues: 0,
                    quantity: unpaidInvoicesQnt,
                    invoiceLink: invoiceLink,
                    invoices: unpaidInvoicesResponse
                });
            }

            if (unpaidInvoicesResponse.length > 0) {
                console.log(`Faturas Unpaid encontradas: ${unpaidInvoicesResponse.length}`);
            } else {
                console.error('Nenhuma fatura encontrada para o cliente');
                res.status(404).send('Nenhuma fatura encontrada');
            }
        } else {
            console.error('Cliente não encontrado ou erro na busca:', clientResponse.message);
            res.json({ clientfound: 0 });
        }
    } catch (error) {
        console.error('Erro ao comunicar com o WHMCS:', error.message);
        res.status(500).send('Erro no servidor');
    }
});

// Inicia o servidor na porta disponibilizada ou 3000
app.listen(port, () => {
    console.log('Servidor rodando na porta', port);
});