require('dotenv').config(); // Getting token from env
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api'); // Telegram bot library for node-js
const token = process.env.TOKEN; // Token of channel by @botfather
const api_link = process.env.API;

bot.on("polling_error", (err) => console.log(err));


//const bot = new TelegramBot(token, { polling: true }); // Run out bot on local

const url = process.env.APP_URL || 'https://express-chatbot.herokuapp.com:443';
const bot = new TelegramBot(token, {webHook: {
    port: process.env.PORT
  } }, ); // Run out bot on local
bot.setWebHook(`${url}/bot${token}`);


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
                console.log(phone_number + ' vs ' + numbers)
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
                    bot.sendMessage(chatId, `Botimizga muvaffaqiyatli ro'yhatdan o'tdizngiz.`)
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
    }
    if(msg.location) {
        axios.get(`${api_link}api/user/client/get?telegramId=${chatId}`).then(response =>{
            var restaurant = response.data.restaurant
            var user = response.data._id;
            var longlat = msg.location.longitude + '&' + msg.location.latitude
            var foods = response.data.cart.map((f) => {
                var obj = {
                    food: f.food._id,
                    count: f.quantity
                }
                return obj
            })
            var stringFood = JSON.stringify(foods)
            axios.get(`https://nominatim.openstreetmap.org/reverse.php?lat=${msg.location.latitude}&lon=${msg.location.longitude}&format=json&accept-language=en`).then(response =>{
                var address = response.data.display_name
                axios.post(`${api_link}api/order/store`, {
                    user: user,
                    longlat: longlat,
                    foods: stringFood,
                    restaurant: restaurant,
                    comment: " ",
                    status: 1,
                    address: address
                }).then((response) => {
                    bot.sendMessage(chatId, "Buyurtma qa'bul qilindi.")
                    botMenu(chatId)
                }, (error) => {
                console.log(error);
                });
            })
            
            

        })
    }


})


bot.on("callback_query", function(query) {
    data = JSON.parse(query.data)
    // Show one restaurant and categories
    if(data.type === 'restaurant') { 
        axios.get(`${api_link}api/restaurant/get`).then(response =>{
            for(var i=0; i < response.data.length; i++) {
                if(data.id === response.data[i]._id) {
                    var obj = response.data[i];
                    var status;
                    if(obj.delivery.enabled) {
                        status = '✅ Ishlamoqda'
                    } else {
                        status = '❌ Vaqtincha ishlamayapti'
                    }
                    var html = `<b>Nomi:</b> ${obj.name}\n<b>Aloqa:</b> ${obj.phone}\n<b>Ish vaqti:</b> ${obj.workingHours}\n<b>Minium buyurtma narxi:</b> ${obj.minimumOrderCost.toLocaleString()} so'm\n<b>Yetkazib berish:</b> ${obj.delivery.price.toLocaleString()} so'm\n<b>Yetkazib berish vaqti:</b> ${obj.delivery.time}\n<b>Yetkazib berish holati:</b> ${status} <a href="${obj.image.url}">&#8205;</a>`
                    var chat_id = query.message.chat.id;
                    var message_id = query.message.message_id;
                    var a = obj.categories.map((x, xi) => ({
                        text: x.name,
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
                        text: "⏪ Ortga",
                        callback_data: JSON.stringify({
                            type: 'allrestaurants'
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
                    break;
                }
            }
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
                        text: `${x.name} - ${x.price.toLocaleString()} so'm`,
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


                    var html = `<b>${obj.name}</b> \n<b>Aloqa:</b> ${obj.phone}<a href="${obj.image.url}">&#8205;</a>`
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
                    var html = `<b>Nomi:</b> ${obj.name}\n<b>Narxi:</b> ${obj.price.toLocaleString()} so'm\n<b>Qo'shimcha:</b> ${obj.description}\n<b>Taom tarkibi:</b> ${obj.ingredients}\n👇 Taom sonini tanlang: <u>DONA</u> / <u>KG</u> 👇<a href="${obj.image.url}">&#8205;</a>`
                    if(obj.stock > 0) {
                        bot.editMessageText(html, {
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
                                        }
                                    ],
                                    [
                                        {
                                            text: "4",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 4 })
                                        },
                                        {
                                            text: "5",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 5 })
                                        },
                                        {
                                            text: "6",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 6 })
                                        } 
                                    ],
                                    [
                                        {
                                            text: "7",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 7 })
                                        },
                                        {
                                            text: "8",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 8 })
                                        },
                                        {
                                            text: "9",callback_data: JSON.stringify({ type: 'add', id: obj._id, quantity: 9 })
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
                axios.post(`${api_link}api/user/client/cart-action`, {
                    clientId: client,
                    foodId: data.id,
                    quantity: data.quantity
                }).then((response) => {
                    if(response.data.result == 'error') {
                        bot.editMessageText(`❗️ Boshqa restorant taomini qo'shmoqchisiz. Iltimos, bitta restarantda buyurtma qiling! Agar ushbu restorantdan buyurtma qilmoqchi bo'lsangiz, savatchangizni tozalang`, {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                            parse_mode: 'HTML',
                            'reply_markup': {
                                'inline_keyboard': [
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
                            var html = `✅ Savatchaga qo'shildi\n<b>Nomi:</b> ${obj.name}\n<b>Narxi:</b> ${obj.price.toLocaleString()} so'm\n<a href="${obj.image.url}">&#8205;</a>`        
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
        
    } else if (data.type === 'empty') {
        axios.get(`${api_link}api/user/client/get?telegramId=${query.from.id}`).then((response) => {
            if(response.data.cart.length > 0) {
                    client = response.data._id;
                    axios.post(`${api_link}api/user/client/cart-action`, {
                        clientId: client,
                        foodId: data.id,
                        quantity: 0
                    }).then((response) => {
                        //console.log(`O'chirildi`)
                    }, (error) => {
                        console.log(`xatolik`)
                        //console.log(error);
                    });
                bot.answerCallbackQuery(query.id, {text: `Olib tashlandi.`})
                if(response.data.cart.length > 1) {
                    busket(query)
                } else {
                    restaurant(query.from.id)
                }
            } else {
                bot.answerCallbackQuery(query.id, {text: `Savatcha bo'sht`, show_alert: true})
            }
        }).catch(err =>{
            console.log(err);
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
        bot.sendMessage(query.message.chat.id, "Joylashgan joyingizni yuboring", {
            reply_markup: {
                resize_keyboard: true,
                keyboard: [
                    [{
                        text: "Yuborish",
                        request_location: true
                    }]
                ]
            }
        })

    } else if(data.type === 'busket') {
        busket(query)
    } else if(data.type === 'foodinfo'){
        bot.answerCallbackQuery(query.id, {text: data.id.toLocaleString() + " so'm"})
    }
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
    bot.sendMessage(chatId, `Bizda mavjud restoranlar ro'yhati yuborilmoqda`);
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
        if(response.data.cart.length > 0) {
            var keyboard = response.data.cart.map((x, xi) => ([{
                text: `${x.food.name}`,
                callback_data: JSON.stringify({
                    type: 'foodinfo',
                    id: x.quantity * x.food.price
                  })
            }, {
                text: "❌",
                callback_data: JSON.stringify({
                    type: 'empty',
                    id: x.food._id
                  })
            }]))
            var option = [{
                text: '✅ Buyurtma berish',
                callback_data: JSON.stringify({
                    type: 'orderbyuser'
                })
            }]
            var option2 = [{
                text: "🍲 Taom tanlash",
                callback_data: JSON.stringify({
                    type: 'allrestaurants'
                })
            }]
            keyboard.push(option2)
            keyboard.push(option)
            var total = 0;
            var itemid
            const html = response.data.cart.map((f, i) => {
                total += f.quantity * f.food.price;
                itemid = f.food._id
                return `${f.quantity} ta ${f.food.name} - ${f.quantity * f.food.price}`
            }).join('\n')
            //console.log(itemid)
            axios.get(`${api_link}api/food/get?id=${itemid}`).then(response =>{
                //console.log(response.data.restaurant)
            }).catch(err =>{

            })
            bot.editMessageText(`Savatchada:\n---------------\n${html}\n<b>Taomlar narxi</b>: ${total.toLocaleString()} so'm`, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                'reply_markup': {
                    'inline_keyboard': keyboard
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

    })
}