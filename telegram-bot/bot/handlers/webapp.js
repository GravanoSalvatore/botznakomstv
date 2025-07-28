module.exports = (bot, db) => {
  // Обработка данных из WebApp
  bot.on('web_app_data', async (ctx) => {
    try {
      const data = JSON.parse(ctx.webAppData.data)
      
      const docRef = await db.collection('profiles').add({
        ...data,
        userId: ctx.from.id,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })
      
      // Уведомление админа
      await bot.telegram.sendMessage(
        process.env.ADMIN_ID,
        `Новая анкета от ${data.name}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Одобрить', callback_data: `approve_${docRef.id}` },
                { text: 'Отклонить', callback_data: `reject_${docRef.id}` }
              ]
            ]
          }
        }
      )
      
      ctx.reply('✅ Анкета успешно отправлена на модерацию!')
    } catch (e) {
      console.error('WebApp error:', e)
      ctx.reply('❌ Ошибка при обработке анкеты')
    }
  })
}