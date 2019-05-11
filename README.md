# stockx-sniper

Bot for [StockX](http://stockx.com/) made by [cactus jack](https://twitter.com/astroworId) and [JM](https://twitter.com/IncorrectCVV) 

### How it works:

- Runnning the bot will pick up the lowest ask for the size you input and if it is under your max price, it will attempt to checkout.  If it is over your max price, the bot will continue to monitor until there is another ask that is lower than your max price.  If you set quantity to a number other than 1, the bot will get the next lowest ask, and attempt to checkout both.
- Setting your size to R, will choose a random size and attempt to check it out.
- Multisizing allows you to set a size range, and the bot will just choose a random size from the range, it is formatted like this: size,size,size (example: 9,9.5,10), would pick any size within 9-10.
- Adding multiple tasks to your tasks.json will run multiple tasks for your desired size(s)/product(s), this can be done by replicating the default task in the tasks.json file and filling all the necessary fields.
- The webhook notification will include a product link, product image, item name, size, purchase price, profile name, order number, account email, and checkout time.  Profile name, order number, and account email will have  spoiler tasks, see webhook example below.  You can use either a slack or discord webhook (see more information below).

### Example of a successful webhook:

![webhookexample](https://i.imgur.com/PpFdWB6.png)

### Installation

StockX Sniper requires [Node.js](http://nodejs.org/).

### Setup:

Edit config.json with your Discord or Slack webhook and retry delay, the default retry delay is 10000 ms.  

Edit profiles.json with your StockX account information in the profiles.json file, and set a profile name.  The bot uses the PayPal account you save to your StockX account, so ensure you have a valid PayPal account saved to your StockX account.

Edit tasks.json with your desired quantity per task, product link, size, profile name, and max price (you can leave this blank if you want any price), max price is just a price that you set that the bot will only attempt to buy a shoe if the price goes under the max price.

See how to create a Slack webhook [here](https://api.slack.com/incoming-webhooks).

See how to create a Discord webhook [here](https://support.discordapp.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

```sh
$ git clone https://github.com/astroworId/stock-sniper.git
$ cd stockx-sniper
$ npm install
$ node index
```
### Proxies?

Not needed, but are supported if you want to add them.  Paste them into the proxies.txt file in one of the formats below.

```
ip:port
ip:port:user:pass
```

### Issues?

DM [me](https://twitter.com/astroworId) on Twitter or Discord @cactus jack#0001, or DM [jm](https://twitter.com/IncorrectCVV) on Twitter or Discord @JIM#8402.

## License

```
The MIT License (MIT)

Copyright (c) 2019 cactus jack <http://twitter.com/astroworId/>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
