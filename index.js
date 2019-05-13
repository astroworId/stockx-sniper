const config = require('./config.json');
const j = require('request').jar();
const request = require('request').defaults({
  timeout: 10000,
  jar: j,
});
const log = require('./logger.js');
const tasks = require('./tasks.json');
const profiles = require('./profiles.json');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const moment = require('moment');

const proxyList = [];
let webhook = formatWH(config.webhook)

function formatWH(url) {
    if (url.includes('/slack') && url.includes('discordapp')) {
      return url
    }
    if (url.includes('discordapp')) {
      return url + '/slack'
    }
    if (url.includes('slack.com')) {
      return url
    }
    return ''
}
Array.prototype.random = function() {
    return this[Math.floor(Math.random() * this.length)];
}
global.formatProxy = (proxy) => { // ty hunter
    if (proxy && ['localhost', ''].indexOf(proxy) < 0) {
        proxy = proxy.replace(' ', '_');
        const proxySplit = proxy.split(':');
        if (proxySplit.length > 3)
            return "http://" + proxySplit[2] + ":" + proxySplit[3] + "@" + proxySplit[0] + ":" + proxySplit[1];
        else
            return "http://" + proxySplit[0] + ":" + proxySplit[1];
    } else
        return undefined;
}
function main() {
    const proxyInput = fs.readFileSync('proxies.txt').toString().split('\n'); // ty hunter
    for (let p = 0; p < proxyInput.length; p++) {
        proxyInput[p] = proxyInput[p].replace('\r', '').replace('\n', '');
        if (proxyInput[p] != '')
            proxyList.push(proxyInput[p]);
    }
    log('Found ' + proxyList.length + ' proxies.', 'success')
    for (let task of tasks) { 
        getProduct(task)
    }
}
function getProduct(task) {
    let startTime = new Date().getTime()
    log('Waiting for product... ' + `[${tasks.indexOf(task)}]`, 'log')
    const opts = {
        url: `https://stockx.com/api/products/${task.productLink.split('.com/')[1]}?includes=market&currency=USD`,
        method: 'GET',
        headers: {
            'appversion': '0.1',
            'appos': 'web',
            'x-requested-with': 'XMLHttpRequest',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36',
            'accept': '*/*',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9'
        },
        gzip: true,
        json: true,
        proxy: formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)])
    };
    request(opts, (e, r, b) => {
        if (e) {
            log('Request error getting product information... ' + `[${tasks.indexOf(task)}]`, 'error')
            console.log(e)
            return setTimeout(getProduct, config.retryDelay, task)
        }
        if (r.statusCode === 200) {
            log('Getting product details... ' + `[${tasks.indexOf(task)}]`, 'log')
            let productName = b.Product.title
            let size = ''
            let sizes = []
            let multisizes = []
            let keys = Object.keys(b.Product.children)
            for (let i = 0; i < keys.length; i++) {
                sizes.push(b.Product.children[keys[i]].market.lowestAskSize)
            }
            for (let i = 0; i < sizes.length; i++) {
                if (sizes[i] === null) {
                    sizes.splice(i)
                }
            }
            if (task.Size === 'R') {
                size = sizes.random()
            } else if (task.Size.length > 4) {
                multisizes = task.Size.split(',')
                for (let i = 0; i < multisizes.length; i++) {
                    if (!sizes.includes(multisizes[i])) {
                        multisizes.splice(i)
                    }
                }
                if (multisizes.length === 0) {
                    log('Size unavailable... ' + `[${tasks.indexOf(task)}] [Size: ${task.Size}]`, 'error')
                    return;
                }
                size = multisizes.random()
            } else if (sizes.includes(task.Size)) {
                size = task.Size 
            } else {
                size = task.Size
                log('Size unavailable... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error')
                return;
            }
            log('Found product: ' + productName + ` [${tasks.indexOf(task)}] [Size: ${size}]`, 'success')
            let productImage = b.Product.media.imageUrl
            let productLink = `https://stockx.com/${b.Product.urlKey}`
            let productUuid = b.Product.market.productUuid
            let priceRange = 0
            if (task.maxPrice === '') {
                priceRange = 99999999
            } else if (parseInt(task.maxPrice) > b.Product.retailPrice) {
                priceRange = task.maxPrice
            } else {
                log('Invalid max price... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error')
                return;
            }
            let asks = []
            let profile = ''
            for (let prof of profiles) {
                if (prof.profileName === task.Profile) {
                    profile = prof
                }
            }
            for (let i = 0; i < keys.length; i++) {
                if (b.Product.children[keys[i]].shoeSize === size) {
                    let skuUuid = b.Product.children[keys[i]].market.skuUuid
                    let lowestAsk = b.Product.children[keys[i]].market.lowestAsk
                    if (lowestAsk < priceRange) {
                        request({
                            url: `https://stockx.com/api/products/${skuUuid}/activity?state=400&currency=USD&limit=${task.Quantity}&page=1&sort=amount&order=ASC&timestamp=${parseInt(Date.now()/1000)}`,
                            method: 'GET',
                            headers: {
                                'appversion': '0.1',
                                'appos': 'web',
                                'x-requested-with': 'XMLHttpRequest',
                                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36',
                                'accept': '*/*',
                                'accept-encoding': 'gzip, deflate, br',
                                'accept-language': 'en-US,en;q=0.9'
                            },
                            gzip: true,
                            json: true,
                            proxy: formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)])
                        }, function (e, r, b) {
                            if (e) {
                                log('Request error getting ask details... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error')
                                console.log(e)
                                return setTimeout(getProduct, config.retryDelay, task)
                            }
                            if (r.statusCode === 200) {
                                for (let i = 0; i < b.ProductActivity.length; i++) {
                                    asks.push(b.ProductActivity[i].localAmount)
                                    
                                }
                                for (let i = 0; i < b.ProductActivity.length; i++) {
                                    if (asks[i] === null) {
                                        asks.splice(i)
                                    }
                                }
                                let loginTask = {
                                    task:task,
                                    startTime:startTime,
                                    productName:productName,
                                    productImage:productImage,
                                    productLink:productLink,
                                    productUuid:productUuid,
                                    profile:profile,
                                    size:size,
                                    skuUuid:skuUuid,
                                    asks:asks
                                }
                                login(loginTask)
                            } else {
                                    log('Error getting ask details... ' + `[${tasks.indexOf(task)}] [Size: ${size}]` + ' [' + r.statusCode + ']', 'error')
                                    console.log(r.body)
                                    return setTimeout(getProduct, config.retryDelay, task)
                                }
                            });
                    } else {
                        log('Out of price range... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'log')
                        return setTimeout(getProduct, config.retryDelay, task)
                    } 
                }
            }
        } else {
            log('Error getting product details... ' + `[${tasks.indexOf(task)}]` + ' [' + r.statusCode + ']', 'error')
            console.log(r.body)
            return setTimeout(getProduct, config.retryDelay, task)
        }
    });
}
function login(loginTask) {
    log('Submitting login information... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'log')
    request({
        url: `https://stockx.com/api/login`,
        method: 'POST',
        headers: {
            'appversion': '0.1',
            'appos': 'web',
            'x-requested-with': 'XMLHttpRequest',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36',
            'accept': '*/*',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9'
        },
        gzip: true,
        form: {
            email: loginTask.profile.account.email,
            password: loginTask.profile.account.password
        },
        json: true,
        proxy: formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)])
    }, function (e, r, b) {
        if (e) {
            log('Request error submitting login information... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error')
            console.log(e)
            return setTimeout(login, config.retryDelay, loginTask)
        }
        if (r.statusCode === 200) {
            log('Logged in... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'success')
            let jwt_token = r.headers['jwt-authorization']
            let grails_user_token = {
                Customer: {  
                    Billing: {  
                       cardType: b.Customer.Billing.cardType,
                       token: b.Customer.Billing.Address.token,
                       last4: b.Customer.Billing.Address.last4,
                       accountEmail: b.Customer.Billing.accountEmail,
                       expirationDate: b.Customer.Billing.Address.expirationDate,
                       cardholderName: b.Customer.Billing.cardholderName,
                       Address:{  
                          firstName: b.Customer.Billing.Address.firstName,
                          lastName: b.Customer.Billing.Address.lastName,
                          telephone: b.Customer.Billing.Address.telephone,
                          streetAddress: b.Customer.Billing.Address.streetAddress,
                          extendedAddress: b.Customer.Billing.Address.extendedAddress,
                          locality: b.Customer.Billing.Address.locality,
                          region: b.Customer.Billing.Address.region,
                          postalCode: b.Customer.Billing.Address.postalCode,
                          countryCodeAlpha2: b.Customer.Billing.Address.countryCodeAlpha2
                       }
                    },
                    Shipping:{  
                       Address:{  
                          firstName: b.Customer.Shipping.Address.firstName,
                          lastName:  b.Customer.Shipping.Address.lastName,
                          telephone: b.Customer.Shipping.Address.telephone,
                          streetAddress: b.Customer.Shipping.Address.streetAddress,
                          extendedAddress: b.Customer.Shipping.Address.extendedAddress,
                          locality: b.Customer.Shipping.Address.locality,
                          region: b.Customer.Shipping.Address.region,
                          postalCode: b.Customer.Shipping.Address.postalCode,
                          countryCodeAlpha2: b.Customer.Shipping.Address.countryCodeAlpha2
                       }
                    },
                    uuid: b.Customer.uuid,
                    id: b.Customer.id,
                    hasBuyerReward: b.Customer.hasBuyerReward
                 }
            }
            grails_user_token = (Buffer.from(JSON.stringify(grails_user_token))).toString('base64');
            let checkoutTask = {
                task:loginTask.task,
                startTime:loginTask.startTime,
                productName:loginTask.productName,
                productImage:loginTask.productImage,
                productLink:loginTask.productLink,
                productUuid:loginTask.productUuid,
                profile:loginTask.profile,
                size:loginTask.size,
                skuUuid:loginTask.skuUuid,
                asks:loginTask.asks,
                grails_user_token:grails_user_token,
                jwt_token:jwt_token
            }
            checkout(checkoutTask)
        } else  {
            log('Error submitting login information... ' + `[${tasks.indexOf(task)}] [Size: ${size}]` + ' [' + r.statusCode + ']', 'error')
            console.log(r.body)
            return setTimeout(login, config.retryDelay, loginTask)
        }
    });
}
function checkout(checkoutTask) {
    log('Attempting ATC... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'log')
    for (let lowestAsk of checkoutTask.asks) {
        request({
            url: `https://gateway.stockx.com/api/v3/pricing/pricing?currency=USD`,
            method: 'POST',
            headers: {
                'x-jwt-authorization': checkoutTask.jwt_token,
                'x-api-key': '99WtRZK6pS1Fqt8hXBfWq8BYQjErmwipa3a0hYxX',
                'x-anonymous-id': uuidv4(),
                'grails-user': checkoutTask.grails_user_token,
                'app-version': '3.11.6.21191',
                'app-platform': 'ios',
                'app-name': 'StockX-iOS',
                'user-agent': 'StockX/21191 CFNetwork/978.0.7 Darwin/18.5.0',
                'accept': '*/*',
                'accept-encoding': 'br, gzip, deflate',
                'accept-language': 'en-US'
            },
            gzip: true,
            body: {
                context: 'buying',
                discountCodes: [''],
                products: [{
                    sku: checkoutTask.skuUuid,
                    quantity: 1,
                    amount: lowestAsk
                }]
            },
            json: true,
            proxy: formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)])
        }, function (e, r, b) {
            if (e) {
                log('Request error adding to cart... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error')
                console.log(e)
                return setTimeout(checkout, config.retryDelay, checkoutTask)
            }
            if (r.statusCode === 200) {
                log('Added to cart...', 'success')
                let date = moment().add(30, 'days').utc().format();
                request({
                    url: `https://gateway.stockx.com/api/v1/portfolio?a=bid`,
                    method: 'POST',
                    headers: {
                        'jwt-authorization': checkoutTask.jwt_token,
                        'x-api-key': '99WtRZK6pS1Fqt8hXBfWq8BYQjErmwipa3a0hYxX',
                        'x-anonymous-id': uuidv4(),
                        'app-version': '3.11.6.21191',
                        'app-platform': 'ios',
                        'app-name': 'StockX-iOS',
                        'user-agent': 'StockX/21191 CFNetwork/978.0.7 Darwin/18.5.0',
                        'accept': '*/*',
                        'accept-encoding': 'br, gzip, deflate',
                        'accept-language': 'en-US'
                    },
                    gzip: true,
                    body: {
                        PortfolioItem: {
                            statusMessage: '',
                            expiresAt: date,
                            skuUuid: checkoutTask.skuUuid,
                            localAmount: lowestAsk,
                            productId: checkoutTask.skuUuid,
                            localCurrency: 'USD'
                        }
                    },
                    json: true,
                    proxy: formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)])
                }, function (e, r, b) {
                    if (e) {
                        log('Request error checking out... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error')
                        console.log(e)
                        return setTimeout(checkout, config.retryDelay, checkoutTask)
                    }
                    if (r.statusCode === 400 && JSON.stringify(b.Error.description).includes('support@stockx.com')) {
                        log('Your account is clipped... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error') // account banned/contact stockx for help
                        console.log(b)
                    } 
                    if (r.statusCode === 200 && JSON.stringify(b.PortfolioItem.statusMessage).includes('Complete')) {
                        console.log(b)
                        log(`Checked out: Size - ${checkoutTask.size}... ` + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'success')
                        let orderNumber = b.PortfolioItem.orderNumber
                        let checkoutTime = (new Date().getTime() - checkoutTask.startTime)/1000
                        let webhookColor = '#00FF6D'
                        let checkoutStatus = 'Checkout: ' + checkoutTask.productName
                        let notifyTask = {
                            task:checkoutTask.task,
                            productName:checkoutTask.productName,
                            productImage:checkoutTask.productImage,
                            productLink:checkoutTask.productLink,
                            profile:checkoutTask.profile,
                            orderNumber:orderNumber,
                            checkoutTime:checkoutTime,
                            checkoutStatus:checkoutStatus,
                            webhookColor:webhookColor,
                            lowestAsk:lowestAsk,
                            size:checkoutTask.size
                        }
                        notify(notifyTask)
                    } else if (b.Error && JSON.stringify(b.Error.description).includes('declined')) {
                        console.log(b)
                        log('Payment declined... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error')
                        let orderNumber = 'Unavailable'
                        let checkoutTime = (new Date().getTime() - checkoutTask.startTime)/1000
                        let webhookColor = '#FE2929'
                        let checkoutStatus = 'Declined: ' + checkoutTask.productName
                        let notifyTask = {
                            task:checkoutTask.task,
                            productName:checkoutTask.productName,
                            productImage:checkoutTask.productImage,
                            productLink:checkoutTask.productLink,
                            profile:checkoutTask.profile,
                            orderNumber:orderNumber,
                            checkoutTime:checkoutTime,
                            checkoutStatus:checkoutStatus,
                            webhookColor:webhookColor,
                            lowestAsk:lowestAsk,
                            size:checkoutTask.size
                        }
                        notify(notifyTask)
                    } else if (r.statusCode !== 400 && r.statusCode !== 200) {
                        log('Error checking out... ' + `[${tasks.indexOf(task)}] [Size: ${size}]` + ' [' + r.statusCode + ']', 'error')
                        console.log(r.body)
                        return setTimeout(checkout, config.retryDelay, checkoutTask)
                    }
                });
            } else {
                log('Error adding to cart... ' + `[${tasks.indexOf(task)}] [Size: ${size}]` + ' [' + r.statusCode + ']', 'error')
                console.log(r.body)
                return setTimeout(checkout, config.retryDelay, checkoutTask)
            }
        });
    }
}
function notify(notifyTask) {
    log('Sending webhook... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'log')
    const message = { 
        username: 'StockX Sniper',
        attachments: [
            {
                author_name: 'StockX Sniper',
                title: notifyTask.checkoutStatus,
                color: notifyTask.webhookColor,
                title_link: notifyTask.productLink,
                fields: [
                { title: 'Item', value: notifyTask.productName, short: true},
                { title: 'Size', value: notifyTask.size, short: true},
                { title: 'Price', value: '$' + notifyTask.lowestAsk, short: true},
                { title: 'Profile', value: '||' + notifyTask.profile.profileName + '||', short: true},
                { title: 'Order Number', value: '||' + notifyTask.orderNumber + '||', short: true},
                { title: 'Account', value: '||' + notifyTask.profile.account.email + '||', short: true},
                { title: 'Checkout Time', value: notifyTask.checkoutTime + 's'}],
                thumb_url: notifyTask.productImage,
                footer: 'StockX Sniper | @stroworld | @IncorrectCVV' ,
                ts: Math.floor(Date.now() / 1000),
                footer_icon: 'https://hypebeast.com/wp-content/blogs.dir/6/files/2018/08/travis-scott-astroworld-tour-dates-tickets-1.jpg'
            }
        ]
    }
    request ({
        url: webhook,
        json: true,
        method: 'POST',
        body: message
    }, function (e) {
        if (e) {
            log('Request error sending webhook... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'error')
            console.log(e)
            return setTimeout(notify, config.retryDelay, notifyTask)
        }
        log('Sent webhook... ' + `[${tasks.indexOf(task)}] [Size: ${size}]`, 'success')
    });
}
main()
