const fetch = require('node-fetch');



class CryptoPayHandler {
    constructor(bot, db) {
        this.bot = bot;
        this.db = db;
        this.token = process.env.CRYPTO_PAY_TOKEN;
        this.baseUrl = 'https://pay.crypt.bot/api';
        console.log('✅ CryptoPayHandler инициализирован');
    }

    async makeRequest(endpoint, method = 'GET', body = null) {
        try {
            console.log(`📡 [CRYPTO] API запрос: ${method} ${endpoint}`);
            
            const options = {
                method,
                headers: {
                    'Crypto-Pay-API-Token': this.token,
                    'Content-Type': 'application/json'
                }
            };

            if (body) {
                options.body = JSON.stringify(body);
                console.log(`📦 [CRYPTO] Тело запроса:`, body);
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, options);
            const data = await response.json();
            
            console.log(`📨 [CRYPTO] Ответ API:`, { 
                ok: data.ok,
                error: data.error 
            });
            
            if (data.ok) {
                console.log(`✅ [CRYPTO] API запрос успешен`);
                return data.result;
            } else {
                console.error('❌ [CRYPTO] API ошибка:', data.error);
                throw new Error(data.error.description || 'CryptoPay API error');
            }
        } catch (error) {
            console.error('❌ [CRYPTO] Ошибка запроса:', error.message);
            throw error;
        }
    }

    async createInvoice(amount, description = 'Оплата подписки', asset = 'USDT') {
        try {
            console.log(`💸 [CRYPTO] Создание инвойса: ${amount} ${asset}, "${description}"`);
            
            const result = await this.makeRequest('/createInvoice', 'POST', {
                asset: asset,
                amount: amount.toString(),
                description: description,
                paid_btn_name: 'openBot',
                paid_btn_url: `https://t.me/${process.env.BOT_USERNAME}`,
                allow_comments: false,
                allow_anonymous: false,
                expires_in: 3600
            });

            console.log(`✅ [CRYPTO] Инвойс создан:`, result);
            return result;

        } catch (error) {
            console.error('❌ [CRYPTO] Ошибка создания инвойса:', error);
            throw error;
        }
    }

    async getInvoice(invoice_id) {
        try {
            console.log(`🔍 [CRYPTO] Получение инвойса: ${invoice_id}`);
            const result = await this.makeRequest(`/getInvoices?invoice_ids=${invoice_id}`);
            
            if (result.items && result.items.length > 0) {
                console.log(`✅ [CRYPTO] Инвойс найден:`, result.items[0]);
                return result.items[0];
            } else {
                console.log(`❌ [CRYPTO] Инвойс не найден: ${invoice_id}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ [CRYPTO] Ошибка получения инвойса ${invoice_id}:`, error.message);
            return null;
        }
    }

    async getBalance() {
        return await this.makeRequest('/getBalance');
    }
}



module.exports = CryptoPayHandler;