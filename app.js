require('dotenv').config(); // Getting token from env
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api'); // Telegram bot library for node-js
const token = process.env.TOKEN; // Token of channel by @botfather
const api_link = process.env.API;


const url = process.env.APP_URL || 'https://express-chatbot.herokuapp.com:443';
const bot = new TelegramBot(token, {webHook: {
    port: process.env.PORT
  } }, ); // Run out bot on local
bot.setWebHook(`${url}/bot${token}`);


//const bot = new TelegramBot(token, { polling: true }); // Run out bot on local


bot.on("polling_error", (err) => console.log(err));

const menu = [
    ["Bizning menu"],
    ["Yordam", "Sozlamalar"] 
]

// Starting point and request phone number
bot.onText(/\/start/, function(msg) {
    var chatId = msg.chat.id
    var hellomsg = `<b>Xush kelibsiz!</b>\nBuyurtma berish telefon raqamingizni yuboring.`
    bot.sendPhoto(chatId, 'https://nodir.educationhost.cloud/tgbotimages/delivery.jpg', {
        'caption': hellomsg,
        'parse_mode': 'HTML',
        'reply_markup': {
            resize_keyboard: true,
            "keyboard": [[{
                    text: "Yuborish",
                    request_contact: true
            }]]
        }
    })
})

bot.on('message', function(msg) {

    var chatId = msg.chat.id
    // If user send contact message and check from database
    if(msg.contact != null) {
        var phone_number = msg.contact.phone_number.replace(/\+/g,'')
        axios.get(`${api_link}api/user/client/get`).then(response =>{
            var newUser = true;
            for(var i = 0; i < response.data.length; i++) {
                var numbers = response.data[i].phone.replace(/ /g,'')
                numbers = numbers.replace(/\+/g,'')
                //console.log(phone_number + ' vs ' + numbers)
                if(phone_number === response.data[i].phone) {
                    newUser = false;
                }
            }
            if(newUser) {
                console.log('create new user');
                axios.post(`${api_link}api/user/client/store`, {
                    name: msg.contact.first_name,
                    phone: msg.contact.phone_number,
                    telegramId: chatId
                }).then((response) => {
                    bot.sendMessage(chatId, `Botimizga muvaffaqiyatli ro'yhatdan o'tdizngiz.`)
                    botMenu(chatId)
                }, (error) => {
                console.log(error);
                });
            } else {
                console.log('old user')
                axios.post(`${api_link}api/user/client/store`, {
                    name: msg.contact.first_name,
                    telegramId: chatId
                }).then((response) => {
                    bot.sendMessage(chatId, `Botimizga muvaffaqiyatli ro'yhatdan o'tdingiz.`)
                    botMenu(chatId)
                }, (error) => {
                console.log(error);
                });
            }
        }).catch(err =>{
            console.log(err)
        })
    }
    // End of registration

    // List of restaurants
    if(msg.text === 'Bizning menu') {
        restaurant(chatId)
    } else if(msg.text === '◀️ Ortga') {
        botMenu(chatId)
    } else {
        if(msg.text) {
            if(msg.text != '/start') {
                axios.get(`${api_link}api/user/client/get?telegramId=${chatId}`).then(nodirresponses =>{
                    if(nodirresponses.data.cart.length > 0) {
                        bot.sendMessage(chatId, "<b>Tasdiqlaysizmi?:</b>\n" + msg.text, {
                            parse_mode: "HTML",
                            reply_markup: {
                                inline_keyboard: [[{
                                    text: "✅ Davom etish",
                                    callback_data: JSON.stringify({
                                        type: 'orderbyuser',
                                        cm : msg.text
                                      })
                                }],[
                                    {
                                        text: "◀️ Ortga",
                                        callback_data: JSON.stringify({
                                            type: 'busket'
                                          })
                                    }
                                ]]
                            }
                        })
                    }
                })

            }
        }

    }


})


bot.on("callback_query", function(query) {
    //chech if user has telegramid
    axios.get(`${api_link}api/user/client/get?telegramId=${query.from.id}`).then(nodirresponses =>{
        data = JSON.parse(query.data)
    // Show one restaurant and categories
    if(data.type === 'restaurant') {
        axios.get(`${api_link}api/restaurant/get?id=${data.id}`).then(response =>{
                    var obj = response.data;
                    var status;
                    if(obj.delivery.enabled) {
                        status = '✅ Ishlamoqda'
                    } else {
                        status = '❌ Vaqtincha ishlamayapti'
                    }
                    var html = `<b>${obj.name}</b>\nYetkazib berish vaqti: ${obj.delivery.time}\nYetkazib berish: ${obj.delivery.price.toLocaleString()} so'm\nMinium buyurtma narxi: ${obj.minimumOrderCost.toLocaleString()} so'm\n☎️ ${obj.phone} | 🕔 ${obj.workingHours}\n<b>Ish holati:</b> ${status}<a href="${obj.image.url}">&#8205;</a>`
                    var chat_id = query.message.chat.id;
                    var message_id = query.message.message_id;
                    var a = obj.categories.map((x, xi) => ({
                        text: x.name.toUpperCase(),
                        callback_data: JSON.stringify({
                            type: 'item',
                            id: data.id,
                            order: xi
                          })
                    }))
                    keyboard = function (array) {
                        var r = [];
                        array.forEach(function (a, i) {
                            if (i % 2) {
                                r[r.length - 1].push(a);
                            } else {
                                r.push([a]);
                            }
                        }, []);
                        return r;
                    }(a);
                    var back = [{
                        text: "🍲 Restorantlar",
                        callback_data: JSON.stringify({
                            type: 'allrestaurants'
                          })
                    }, {
                        text: "🛒 Savatcha",
                        callback_data: JSON.stringify({
                            type: 'busket'
                          })
                    }]
                    keyboard.push(back)
                    
                    bot.editMessageText(html, {
                        chat_id: chat_id,
                        message_id: message_id,
                        parse_mode: 'HTML',
                        'reply_markup': {
                            inline_keyboard: keyboard
                        }
                    })

            
        }).catch(err =>{
            console.log(err);
        })
    } else if (data.type === 'item') {
        // Show foods in category
        axios.get(`${api_link}api/restaurant/get`).then(response =>{
            for(var i=0; i < response.data.length; i++) {
                if(data.id === response.data[i]._id) {
                    let obje = response.data[i].categories[data.order].foods;
                    var chat_id = query.message.chat.id;
                    var message_id = query.message.message_id;
                    var obj = response.data[i];
                    var a = obje.map((x, xi) => ({
                        text: `${x.name}`,
                        callback_data: JSON.stringify({
                            type: 'food',
                            id: x._id
                          })
                    }))
                    keyboard = function (array) {
                        var r = [];
                        array.forEach(function (a, i) {
                            if (i % 2) {
                                r[r.length - 1].push(a);
                            } else {
                                r.push([a]);
                            }
                        }, []);
                        return r;
                    }(a);
                    var back = [{
                        text: "⏪ Ortga",
                        callback_data: JSON.stringify({
                            type: 'restaurant',
                            id: obj._id
                          })
                    }]
                    keyboard.push(back)


                    var html = `Taomni tanlang`
                    bot.editMessageText(html, {
                        chat_id: chat_id,
                        message_id: message_id,
                        parse_mode: 'HTML',
                        reply_markup: JSON.stringify({
                            inline_keyboard: keyboard
                        }),
                    })
                    break;
                }
            }
        }).catch(err =>{
            console.log(err);
        })
    } else if(data.type === 'food') {
        // Show food
        axios.get(`${api_link}api/food/get?id=${data.id}`).then(response =>{
                    var obj = response.data;
                    if(obj.ingredients != null) {
                        ingredients = `\nTarkibi: ${obj.ingredients}`
                    } else {
                        ingredients = ""
                    }
                    var html = `<b>${obj.name}</b>\nIzoh: ${obj.description}${ingredients}\n<b>Narxi:</b> ${obj.price.toLocaleString()} so'm<a href="${obj.image.url}">&#8205;</a>`
                    if(obj.stock > 0 || obj.stock === null) {
                        bot.editMessageText(html + '\n👇 Taom sonini tanlang: <u>DONA</u> / <u>KG</u>', {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                            parse_mode: 'HTML',
                            'reply_markup': {
                                'inline_keyboard': [
                                    [
                                        {
                                            text: "1",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 1 })
                                        },
                                        {
                                            text: "2",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 2 })
                                        },
                                        {
                                            text: "3",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 3 })
                                        },
                                        {
                                            text: "4",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 4 })
                                        }
                                    ],
                                    [
                                        {
                                            text: "5",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 5 })
                                        },
                                        {
                                            text: "6",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 6 })
                                        },
                                        {
                                            text: "7",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 7 })
                                        },
                                        {
                                            text: "8",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 8 })
                                        }
                                    ],
                                    [
                                        {
                                            text: "⏪ Ortga",callback_data: JSON.stringify({ type: 'restaurant', id: obj.restaurant })
                                        }
                                    ]
                                ]
                            }
                        })
                    } else {
                        bot.editMessageText(html + "\n❗️ Ushbu taomni hozirda buyurtma qilib bo'lmaydi. ", {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                            parse_mode: 'HTML',
                            'reply_markup': {
                                'inline_keyboard': [
                                    [
                                        {
                                            text: "⏪ Ortga",callback_data: JSON.stringify({ type: 'restaurant', id: obj.restaurant })
                                        }
                                    ],
                                    [{
                                        text: "🛒 Savatchani ko'rish",
                                        callback_data: JSON.stringify({
                                            type: 'busket'
                                        })
                                    }]
                                ]
                            }
                        })
                    }


            
        }).catch(err =>{
            console.log(err);
        })
    } else if (data.type === 'add') {
        // Add to busket
        axios.get(`${api_link}api/user/client/get?telegramId=${query.from.id}`).then((response) => {
            var client = response.data._id;
            var initial_qunatity = 0;
            for(var i=0;i<response.data.cart.length;i++) {
                if(data.id === response.data.cart[i].food._id){
                    initial_qunatity+=response.data.cart[i].quantity
                }
            }
                axios.post(`${api_link}api/user/client/cart-action`, {
                    clientId: client,
                    foodId: data.id,
                    quantity: data.quantity + initial_qunatity
                }).then((response) => {
                    if(response.data.result == 'error') {
                        bot.editMessageText(`❗️ Boshqa restorant taomini qo'shmoqchisiz.\nIltimos, bitta restarantda buyurtma qiling!\nAgar ushbu restorantdan buyurtma qilmoqchi bo'lsangiz, savatchangizni tozalang.`, {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                            parse_mode: 'HTML',
                            'reply_markup': {
                                'inline_keyboard': [
                                    [
                                        {
                                            text: "🗑 Savatchani tozalash",
                                            callback_data: JSON.stringify({
                                                type: 'empty_busket_back',
                                                foodid: data.id
                                            })
                                        } 
                                    ],
                                    [{
                                        text: "⏪ Ortga",
                                        callback_data: JSON.stringify({
                                            type: 'food',
                                            id: data.id
                                        })
                                    },{
                                        text: "🛒 Savatchani ko'rish",
                                        callback_data: JSON.stringify({
                                            type: 'busket'
                                        })
                                    }]
                                ]
                            }
                        })
                    } else {
                        axios.get(`${api_link}api/food/get?id=${data.id}`).then(response =>{
                            var restorantid = response.data.restaurant
                            var obj = response.data;
                            bot.answerCallbackQuery(query.id, {text: `Savatchaga qo'shildi`, show_alert: true})
                            var html = `✅ Savatchaga qo'shildi: <b>${obj.name}</b>\n${obj.price.toLocaleString()} x ${data.quantity} = ${(obj.price * data.quantity).toLocaleString()} so'm`        
                            bot.editMessageText(html, {
                                chat_id: query.message.chat.id,
                                message_id: query.message.message_id,
                                parse_mode: 'HTML',
                                'reply_markup': {
                                    'inline_keyboard': [
                                        [{
                                            text: "⏪ Restorantga qaytish",
                                            callback_data: JSON.stringify({
                                                type: 'restaurant',
                                                id: restorantid
                                            })
                                        }],
                                        [{
                                            text: "🛒 Savatchani ko'rish",
                                            callback_data: JSON.stringify({
                                                type: 'busket'
                                            })
                                        }]
                                    ]
                                }
                            })
                        }).catch(err => {

                        })

                    }
                  }).catch((err) =>{
                   
                })
            
        }).catch(err =>{
            console.log(err);
        })
        
    } else if (data.type === "empty_busket"){
        axios.get(`${api_link}api/user/client/get?telegramId=${query.from.id}`).then((response) => {
            //console.log(response.data.cart)
            if(response.data.cart.length > 0) {
                axios.post(`${api_link}api/user/client/clear-cart`, {
                    clientId: response.data._id
                }).then((response) => {
                    //bot.answerCallbackQuery(query.id, {text: `Savatchangiz bo'sht`})
                    bot.editMessageText(`Savatchangiz bo'shtatildi`, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        parse_mode: 'HTML',
                        'reply_markup': {
                            'inline_keyboard': [
                                [{
                                    text: "🍲 Taom tanlash",
                                    callback_data: JSON.stringify({
                                        type: 'allrestaurants'
                                    })
                                }]
                            ]
                        }
                    })
                }, (error) => {
                    console.log(`Xatolik\n`)
                    //console.log(error.data);
                });
            } else {
                bot.answerCallbackQuery(query.id, {text: `Savatchangiz bo'sht`})
            }
            
        })
    } else if(data.type === "empty_busket_back") {
        axios.get(`${api_link}api/user/client/get?telegramId=${query.from.id}`).then((response) => {
            //console.log(response.data.cart)
            if(response.data.cart.length > 0) {
                axios.post(`${api_link}api/user/client/clear-cart`, {
                    clientId: response.data._id
                }).then((response) => {
                    //bot.answerCallbackQuery(query.id, {text: `Savatchangiz bo'sht`})
                    bot.editMessageText(`✅ Savatchangiz bo'shtatildi`, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        parse_mode: 'HTML',
                        'reply_markup': {
                            'inline_keyboard': [
                                [{
                                    text: "◀️ Taomga qaytish",
                                    callback_data: JSON.stringify({
                                        type: 'food',
                                        id: data.foodid
                                    })
                                }]
                            ]
                        }
                    })
                }, (error) => {
                    console.log(`Xatolik\n`)
                    //console.log(error.data);
                });
            } else {
                bot.answerCallbackQuery(query.id, {text: `Savatchangiz bo'sht`})
            }
            
        })
    } else if (data.type === 'allrestaurants') {
        // Show all restaurants
        axios.get(`${api_link}api/restaurant/get`).then(response =>{
            var a = response.data.map((x, xi) => ({
                text: `${xi + 1}. ${x.name}`,
                callback_data: JSON.stringify({
                    type: 'restaurant',
                    id: x._id
                  })
            }))
            keyboard = function (array) {
                var r = [];
                array.forEach(function (a, i) {
                    if (i % 2) {
                        r[r.length - 1].push(a);
                    } else {
                        r.push([a]);
                    }
                }, []);
                return r;
            }(a);
            var option = [{
                text: '🛒 Savatcha',
                callback_data: JSON.stringify({
                    type: 'busket'
                })
            }]
            keyboard.push(option)

            bot.editMessageText("👇 Restoranni tanlang", {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: JSON.stringify({
                    inline_keyboard: keyboard,
                }),
            })
        }).catch(err =>{
            console.log(err);
        })
    } else if(data.type === 'orderbyuser') {
        bot.editMessageText("📍 Joylashgan joyingizni yuboring", {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
        })
        bot.sendMessage(query.from.id, '👇 👇 👇', {
            reply_markup: {
                resize_keyboard: true,
                keyboard: [
                    [{
                        text: "📍 Yuborish",
                        request_location: true
                    },{
                        text: '◀️ Ortga'
                    }]
                ]
            }
        })
        bot.on('message', (msgs) => {
            if(msgs.location) {
                axios.get(`${api_link}api/user/client/get?telegramId=${query.from.id}`).then(responses =>{
                    if(responses) {
                        if(responses.data.cart.length > 0) {
                            axios.get(`${api_link}api/restaurant/get?id=${responses.data.restaurant}`).then(res =>{
                                if(res) {
                                    var restaurant = responses.data.restaurant
                                    var user = responses.data._id;
                                    var longlat = msgs.location.longitude + '&' + msgs.location.latitude
                                    var foods = responses.data.cart.map((f) => {
                                        var obj = {
                                            food: f.food._id,
                                            count: f.quantity
                                        }
                                        return obj
                                    })
                                    var stringFood = JSON.stringify(foods)
                                    axios.get(`https://nominatim.openstreetmap.org/reverse.php?lat=${msgs.location.latitude}&lon=${msgs.location.longitude}&format=json&accept-language=en`).then(response =>{
                                        var address = response.data.display_name
                                        mycomment = '-'
                                        if(data.cm) {
                                            mycomment = data.cm
                                        }
                                        axios.post(`${api_link}api/order/store`, {
                                            user: user,
                                            longlat: longlat,
                                            foods: stringFood,
                                            restaurant: restaurant,
                                            comment: mycomment,
                                            status: 1,
                                            address: address
                                        }).then((response) => {
            
                                            axios.post(`${api_link}api/user/client/clear-cart`, {
                                                clientId: user
                                            }).then((nodirresponse) => {
                                            //console.log(response.data)
                                            var total = 0;
                                            const html = responses.data.cart.map((f, i) => {
                                                total += f.quantity * f.food.price;
                                                return `${i +1}. ${f.food.name} - ${f.quantity} x ${f.food.price.toLocaleString()} = ${(f.quantity * f.food.price).toLocaleString()} so'm`
                                            }).join('\n')
                                            bot.sendMessage(query.from.id, `✅ Buyurtma qa'bul qilindi.\n${html}\nTaomlar narxi:${total.toLocaleString()} so'm\nYetkazib berish narxi: ${res.data.delivery.price.toLocaleString()} so'm\n\n<b>UMUMIY:</b> ${(total + res.data.delivery.price).toLocaleString()} so'm\n<b>Manzil:</b> ${address}\nIzoh: ${mycomment}`, {
                                                parse_mode: 'HTML'
                                            })
                                            botMenu(query.from.id)
                                            }, (error) => {
                                                console.log(`Xatolik`)
                                            });
            
                                        }, (error) => {
                                            console.log(error);
                                        });
                                    })
                                }            
                            })
                        } else {
                            bot.sendMessage(query.from.id, `Savatchangiz bo'sht`, {
                                parse_mode: 'HTML'
                            })
                        }
        
                    }
                    
                    
                    
        
                })
            }
        })
    } else if(data.type === 'busket') {
        busket(query)
    } else if(data.type === 'foodinfo'){
        bot.answerCallbackQuery(query.id, {text: data.id.toLocaleString() + " so'm"})
    } else if(data.type === 'add_comment') {
        bot.editMessageText("Qo'shimcha izoh kiritasizmi?", {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            'reply_markup': {
                'inline_keyboard': [
                    [{
                        text: "➡️ Izohsiz",
                        callback_data: JSON.stringify({
                            type: 'orderbyuser'
                        })
                    }],
                    [{
                        text: "✍️ Izoh qo'shish",
                        callback_data: JSON.stringify({
                            type: 'make_comment'
                        })
                    }]
                ]
            }
        })
    } else if(data.type === 'make_comment'){
        bot.editMessageText("Izohingizni yozing", {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
        })
        bot.sendMessage(query.from.id, '✍️ ✍️ ✍️', {
            reply_markup: {
                remove_keyboard: true
            }
        })
    }else {
        bot.answerCallbackQuery(query.id, {text: "Xatolik"})
    }
    }).catch(err =>{
        var hellomsg = `<b>Xush kelibsiz!</b>\nBuyurtma berish telefon raqamingizni yuboring.`
        bot.sendMessage(query.from.id, hellomsg, {
            'parse_mode': 'HTML'
        })
        bot.sendMessage(query.from.id, "Telefon raqamingizni yuboring", {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            'parse_mode': 'HTML',
            'reply_markup': {
                resize_keyboard: true,
                "keyboard": [[{
                        text: "Yuborish",
                        request_contact: true
                }]]
            }})
    })
    
})

// 
function botMenu(chatId) {
    bot.sendMessage(chatId, 'Amalni tanlang', {
        reply_markup: {
            resize_keyboard: true,
            keyboard: menu
        }
    })
}


// When user pressed our restaurants
function restaurant(chatId) {
    //bot.sendMessage(chatId, `Bizda mavjud restoranlar ro'yhati yuborilmoqda`);
    axios.get(`${api_link}api/restaurant/get`).then(response =>{
        var a = response.data.map((x, xi) => ({
            text: `${xi + 1}. ${x.name}`,
            callback_data: JSON.stringify({
                type: 'restaurant',
                id: x._id
              })
        }))
        keyboard = function (array) {
            var r = [];
            array.forEach(function (a, i) {
                if (i % 2) {
                    r[r.length - 1].push(a);
                } else {
                    r.push([a]);
                }
            }, []);
            return r;
        }(a);
        var option = [{
            text: '🛒 Savatcha',
            callback_data: JSON.stringify({
                type: 'busket'
            })
        }]
        keyboard.push(option)
        bot.sendMessage(chatId,"👇 Restoranni tanlang", {
            parse_mode: 'HTML',
            reply_markup: JSON.stringify({
                inline_keyboard: keyboard,
            }),
        })
    }).catch(err =>{
        console.log(err);
    })
}

function busket(query){
    axios.get(`${api_link}api/user/client/get?telegramId=${query.from.id}`).then(response =>{
        //console.log(response.data.cart)
        if(response.data.cart.length > 0) {
            axios.get(`${api_link}api/restaurant/get?id=${response.data.restaurant}`).then(res =>{
                if(res.data.delivery.enabled == true) {

                    var delivery_cost = res.data.delivery.price
                    var keyboard = [
                        [{
                            text: `🗑 Savatchani bo'shatish`,
                            callback_data: JSON.stringify({
                                type: 'empty_busket'
                            })
                        }],
                        [{
                            text: '🚖 Buyurtma berish',
                            callback_data: JSON.stringify({
                                type: 'add_comment'
                            })
                        }],
                        [{
                            text: `"🍲 ${res.data.name}"dan taom tanlash`,
                            callback_data: JSON.stringify({
                                type: 'restaurant',
                                id: res.data._id
                            })
                        }]
                    ]
                    var keyboards = [
                        [{
                            text: `🗑 Savatchani bo'shatish`,
                            callback_data: JSON.stringify({
                                type: 'empty_busket'
                            })
                        }],
                        [{
                            text: `"🍲 ${res.data.name}"dan taom tanlash`,
                            callback_data: JSON.stringify({
                                type: 'restaurant',
                                id: res.data._id
                            })
                        }]
                    ]
                    var total = 0;
                    var itemid
                    const html = response.data.cart.map((f, i) => {
                        total += f.quantity * f.food.price;
                        itemid = f.food._id
                        return `${i + 1}. ${f.food.name} ${f.quantity} x ${f.food.price.toLocaleString()} = ${(f.quantity * f.food.price).toLocaleString()} so'm`
                    }).join('\n')
                    if(total >= res.data.minimumOrderCost) {
                        bot.editMessageText(`Savatchada: <b>${res.data.name}</b>\n---------------\n${html}\n---------------\nTaomlar narxi: ${total.toLocaleString()} so'm\nYetkazib berish: ${delivery_cost.toLocaleString()} so'm\n<b>UMUMIY:</b> ${(total + delivery_cost).toLocaleString()} so'm`, {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                            parse_mode: 'HTML',
                            'reply_markup': {
                                'inline_keyboard': keyboard
                            }
                        })
                    } else {
                        bot.editMessageText(`Savatchada: <b>${res.data.name}</b>\n---------------\n${html}\n---------------\nTaomlar narxi: ${total.toLocaleString()} so'm\n❗️ Ushbu restarantdan minium buyurtma berish narxi: ${res.data.minimumOrderCost.toLocaleString()} so'm. Iltimos yana taom qo'shing`, {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                            parse_mode: 'HTML',
                            'reply_markup': {
                                'inline_keyboard': keyboards
                            }
                        })
                    }
                    
                } else {
                    //if restaurant not working
                    bot.editMessageText(`Restaurant ish faoliyatida emas`, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        parse_mode: 'HTML',
                        'reply_markup': {
                            'inline_keyboard': [
                                [{
                                    text: "🍲 Taom tanlash",
                                    callback_data: JSON.stringify({
                                        type: 'allrestaurants'
                                    })
                                }]
                            ]
                        }
                    })
                }
            })
            
    } else {
        // Busket is empty
        bot.editMessageText(`😌 Savatchangiz bo'sht`, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            'reply_markup': {
                'inline_keyboard': [
                    [{
                        text: "🍲 Taom tanlash",
                        callback_data: JSON.stringify({
                            type: 'allrestaurants'
                        })
                    }]
                ]
            }
        })
    }
    }).catch(err =>{
        //console.log(err)
    })
}