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
    log('Waiting for product...', 'log')
    request({
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
    }, function (e, r, b) {
        if (e) {
            log('Request error getting product information...', 'error')
            console.log(e)
            return setTimeout(getProduct, config.retryDelay, task)
        }
        if (r.statusCode === 200) {
            log('Getting product details...', 'log')
            let productName = b.Product.title
            log('Found product: ' + productName, 'success')
            let productImage = b.Product.media.imageUrl
            let productLink = `https://stockx.com/${b.Product.urlKey}`
            let productUuid = b.Product.market.productUuid
            let priceRange = 0
            if (task.maxPrice === '') {
                priceRange = 99999999
            } else if (parseInt(task.maxPrice) > b.Product.retailPrice) {
                priceRange = task.maxPrice
            }
            let asks = []
            let sizes = []
            let keys = Object.keys(b.Product.children)
            let profile = ''
            let size = ''
            for (let prof of profiles) {
                if (prof.profileName === task.Profile) {
                    profile = prof
                }
            }
            if (task.Size === 'R') {
                for (let i = 0; i < keys.length; i++) {
                    sizes.push(b.Product.children[keys[i]].market.lowestAskSize)
                }
                size = sizes.random()
            } else {
                size = task.Size 
            }
            for (let i = 0; i < keys.length; i++) {
                if (b.Product.children[keys[i]].shoeSize === size) {
                    let skuUuid = b.Product.children[keys[i]].market.skuUuid
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
                            log('Request error getting ask details...', 'error')
                            console.log(e)
                            return setTimeout(getProduct, config.retryDelay, task)
                        }
                        if (r.statusCode === 200) {
                            for (let i = 0; i < b.ProductActivity.length; i++) {
                                asks.push(b.ProductActivity[i].localAmount)
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
                            if (asks[0] < priceRange) {
                                login(loginTask)
                            } else {
                                log('Out of price range...', 'log')
                                return setTimeout(getProduct, config.retryDelay, task)
                            }
                        } else {
                                log('Error getting ask details... ' + '[' + r.statusCode + ']', 'error')
                                console.log(r.body)
                                return setTimeout(getProduct, config.retryDelay, task)
                            }
                        });
                }
            }
        } else {
            log('Error getting product details... ' + '[' + r.statusCode + ']', 'error')
            console.log(r.body)
            return setTimeout(getProduct, config.retryDelay, task)
        }
    });
}
function login(loginTask) {
    log('Submitting login information...', 'log')
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
            log('Request error submitting login information...', 'error')
            console.log(e)
            return setTimeout(login, config.retryDelay, loginTask)
        }
        if (r.statusCode === 200) {
            log('Logged in...', 'success')
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
            log('Error submitting login information... ' + '[' + r.statusCode + ']', 'error')
            console.log(r.body)
            return setTimeout(login, config.retryDelay, loginTask)
        }
    });
}
function checkout(checkoutTask) {
    log('Attempting ATC...', 'log')
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
                log('Request error adding to cart...', 'error')
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
                    console.log(b)
                    if (e) {
                        log('Request error checking out...', 'error')
                        console.log(e)
                        return setTimeout(checkout, config.retryDelay, checkoutTask)
                    }
                    if (r.statusCode === 400 && JSON.stringify(b.Error.description).includes('support@stockx.com')) {
                        log('Your account is clipped...', 'error') // account banned/contact stockx for help
                        console.log(b)
                    } 
                    if (r.statusCode === 200 && JSON.stringify(b.PortfolioItem.statusMessage).includes('Complete')) {
                        console.log(b)
                        log('Checked out...', 'success')
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
                            lowestAsk:lowestAsk
                        }
                        notify(notifyTask)
                    } else if (b.Error && JSON.stringify(b.Error.description).includes('declined')) {
                        console.log(b)
                        log('Payment declined...', 'error')
                        let orderNumber = 'Unavailable' // not sure if this is possible
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
                            lowestAsk:lowestAsk
                        }
                        notify(notifyTask)
                    } else if (r.statusCode !== 400 && r.statusCode !== 200) {
                        log('Error checking out... ' + '[' + r.statusCode + ']', 'error')
                        console.log(r.body)
                        return setTimeout(checkout, config.retryDelay, checkoutTask)
                    }
                });
            } else {
                log('Error adding to cart... ' + '[' + r.statusCode + ']', 'error')
                console.log(r.body)
                return setTimeout(checkout, config.retryDelay, checkoutTask)
            }
        });
    }
}
function notify(notifyTask) {
    log('Sending webhook...', 'log')
    const message = { 
        username: 'StockX Sniper',
        attachments: [
            {
                title: notifyTask.checkoutStatus,
                color: notifyTask.webhookColor,
                title_link: notifyTask.productLink,
                fields: [
                { title: 'Item', value: notifyTask.productName, short: true},
                { title: 'Size', value: notifyTask.task.Size, short: true},
                { title: 'Price', value: '$' + notifyTask.lowestAsk, short: true},
                { title: 'Profile', value: '||' + notifyTask.profile.profileName + '||', short: true},
                { title: 'Order Number', value: '||' + notifyTask.orderNumber + '||', short: true},
                { title: 'Account', value: '||' + notifyTask.profile.account.email + '||', short: true},
                { title: 'Checkout Time', value: notifyTask.checkoutTime + 's'}],
                thumb_url: notifyTask.productImage,
                footer: 'Stockx Sniper | @stroworld | @IncorrectCVV' ,
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
            log('Request error sending webhook...', 'error')
            console.log(e)
            return setTimeout(notify, config.retryDelay, notifyTask)
        }
        log('Sent webhook...', 'success')
    });
}
main()
