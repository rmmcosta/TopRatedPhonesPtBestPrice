const express = require('express');
const app = express();
const rp = require('request-promise');
const $ = require('cheerio');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');

cron.schedule('0 0 * * *', () => {
    console.log('running cron');
    writePhonePrices2File();
}, {
    scheduled: true,
    timezone: "Europe/London"
});

async function writePhonePrices2File() {
    const phoneList = await getTopRatedPhones();
    const priceList = await getBestPrices(phoneList);
    let today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    const yyyy = today.getFullYear();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds()
    today = mm + '/' + dd + '/' + yyyy + ' ' + time;
    let html = '<h6 class="w-100 p-3">Updated at:'+today+'</h6><table class="table">' +
        '<thead class="thead-dark">' +
        '<tr>' +
        '<th>Phone</th>' +
        '<th>Worten</th>' +
        '<th>Tek4Life</th>' +
        '</tr></thead><tbody>';
    priceList.forEach(phone => {
        html = html + '<tr>' +
            '<td>' +
            phone.name +
            '</td><td>' +
            phone.worten + ' €</td>' +
            '</td><td>' +
            (isNaN(phone.tek4life) ? 'N/A' : phone.tek4life) + ' €</td></tr>';
    });
    html = html + '</tbody></table>';
    fs.writeFile('phonePrices.html', html, function (err) {
        if (err) throw err;
        console.log('File is created successfully.');
    });
}

//url for Techradar top rated phones
const trTopRatedPhonesURL = 'https://www.techradar.com/uk/news/best-phone';

//const whitelist = ['localhost'];
const corsOptions = {
    origin: function (origin, callback) {
        console.log(origin);
        return callback(null, true);
    }
}

app.get('/startFile', (req, res) => {
    writePhonePrices2File();
    res.send('Triggered writePhonePrices2File!');
});

app.get('/readFile', (req, res) => {
    fs.readFile('phonePrices.html',
        // callback function that is called when reading file is done
        function (err, data) {
            if (err) console.log(err);
            // data is a buffer containing file content
            res.send(data.toString('utf8'));
        });
});

app.get('/phones', async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    const phoneList = await getTopRatedPhones();
    const priceList = await getBestPrices(phoneList);
    let html = '<h2>Best phones and prices</h2><hr><br>' +
        '<table style="border: 1px solid black; text-align:left; padding:5px;">' +
        '<tr style="background-color:#46A049;padding:5px;">' +
        '<th style="padding:5px; color:white;">Phone</th>' +
        '<th style="padding:5px; color:white;">Worten</th>' +
        '<th style="padding:5px; color:white;">Tek4Life</th>' +
        '</tr>';
    priceList.forEach(phone => {
        html = html + '<tr style="border-bottom: 1px solid gray; background-color:white; padding: 5px;">' +
            '<td style="padding:5px;">' +
            phone.name +
            '</td><td style="padding:5px;">' +
            phone.worten + ' €</td>' +
            '</td><td style="padding:5px;">' +
            (isNaN(phone.tek4life) ? 'N/A' : phone.tek4life) + ' €</td></tr>';
    });
    html = html + '</table>';
    res.send(html);
});

//start the app on the given port
const listenHandler = (err) => {
    if (err) {
        console.log(err);
    } else {
        console.log(`Web conference up and running on ${host}:${port}`);
    }
}

const host = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 8080;

app.listen(port, listenHandler);

//fetch the top rated phones
async function getTopRatedPhones() {
    return rp(trTopRatedPhonesURL)
        .then(
            techradarHtml => {
                let topRatedPhonesArray = $('#article-body ol li', techradarHtml);
                //console.log(topRatedPhonesArray);
                let numOfTopRatedPhones = topRatedPhonesArray.length;
                //console.log('numOfTopRatedPhones',numOfTopRatedPhones);
                let namesArray = [];
                let phoneName = topRatedPhonesArray[0].children[0].data;
                if (phoneName.indexOf('/') > 0) {
                    phoneName = phoneName.substr(0, phoneName.indexOf('/'));
                }
                namesArray.push({
                    name: phoneName,
                    worten: 'N/A',
                    tek4life: 'N/A'
                });
                //console.log($('#article-body ol li',htmlString)[2].children[0].children[0].data);
                for (let i = 1; i < numOfTopRatedPhones; i++) {
                    //console.log(topRatedPhonesArray[i]);
                    phoneName = topRatedPhonesArray[i].children[0].children[0].data;
                    if (phoneName.indexOf('/') > 0) {
                        phoneName = phoneName.substr(0, phoneName.indexOf('/'));
                    }
                    namesArray.push({
                        name: phoneName,
                        worten: 'N/A',
                        tek4life: 'N/A'
                    });
                }
                return namesArray;
            })
        .catch(
            error => {
                return error;
            }
        )
}

async function getBestPrices(phonesList) {
    for (let i = 0; i < phonesList.length; i++) {
        phonesList[i].worten = await getPriceByShop(phonesList[i].name, 'worten');
        phonesList[i].tek4life = await getPriceByShop(phonesList[i].name, 'tek4life');
    }
    return phonesList;
}

async function getPriceByShop(phoneName, shop) {
    const shopsURLs = {
        worten: 'https://www.worten.pt/search?query=' + phoneName,
        mediaMarkt: 'https://mediamarkt.pt/pages/search-results-page?q=' + phoneName,
        fnac: 'https://www.fnac.pt/SearchResult/ResultList.aspx?Search=' + phoneName,
        radioPopular: 'https://www.radiopopular.pt/pesquisa/' + phoneName,
        tek4life: 'https://www.tek4life.pt/pt/catalogsearch/result/?q=' + phoneName,
        phoneHouse: 'https://www.phonehouse.pt/pt/resultados-de-pesquisa_36.html?c=1&term=' + phoneName,
        boxJumbo: 'https://www.auchan.pt/Frontoffice/search/' + phoneName
    };

    const options = {
        url: shopsURLs[shop],
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36'
        }
    }
    let bestPrice = '';
    switch (shop) {
        case 'worten':
            bestPrice = await getWortenBestPrice(options, phoneName);
            break;
        case 'tek4life':
            bestPrice = await getTek4LifeBestPrice(options, phoneName);
            break;
        default:
            break;
    }
    console.log(bestPrice);
    return bestPrice;
}

async function getWortenBestPrice(options, phoneName) {
    const phoneNamePatt = new RegExp('\\b' + phoneName + '\\b', 'i');
    const litePatt = new RegExp('\\bLite\\b', 'i');
    const proPatt = new RegExp('\\Pro\\b', 'i');
    //console.log(phoneName);
    return rp(options)
        .then(htmlPrices => {
            let pricesObj = $('div.w-product__content .w-currentPrice .w-product-price__main', htmlPrices);
            let numPrices = pricesObj.length;
            let bestPrice = 10000;
            let currPrice = 10000;
            let currTitle = '';
            let regexCheck = '';
            let regexLiteCheck = '';
            let regexProCheck = '';
            let numPrices2 = '';
            for (let i = 0; i < numPrices; i++) {
                try {
                    numPrices2 = pricesObj[i].children.length;
                    //console.log('numPrices2:',numPrices2);
                    for (let j = 0; j < numPrices2; j++) {
                        currPrice = pricesObj[i].children[0].data;
                        currPrice = parseInt(currPrice);
                        if (!isNaN(currPrice)) {
                            //console.log('value found');
                            break;
                        }
                    }
                    currTitle = pricesObj[i].parent.parent.parent.parent.children[0].children[0].children[0].children[0].data;
                    regexCheck = phoneNamePatt.test(currTitle);
                    regexLiteCheck = !litePatt.test(currTitle);
                    regexProCheck = (!proPatt.test(phoneName) && !proPatt.test(currTitle)) || (proPatt.test(phoneName) && proPatt.test(currTitle));
                    //console.log('currtitle:',currTitle);
                    //console.log(currPrice);
                    //>200 to ignore accessories
                    if (regexCheck && regexLiteCheck && regexProCheck && currPrice > 200) {
                        bestPrice = Math.min(currPrice, bestPrice);
                    }
                } catch (error) {
                    //do nothing
                }
            }
            //console.log(bestPrice);
            return bestPrice == 10000 ? 'N/A' : bestPrice;
        })
        .catch(error => {
            return error;
        });
}

async function getTek4LifeBestPrice(options, phoneName) {
    const phoneNamePatt = new RegExp('\\b' + phoneName + '\\b', 'i');
    const litePatt = new RegExp('\\bLite\\b', 'i');
    const proPatt = new RegExp('\\Pro\\b', 'i');
    //console.log(phoneName);
    return rp(options)
        .then(htmlPrices => {
            let pricesObj = $('.category-products span.price', htmlPrices);
            let numPrices = pricesObj.length;
            let bestPrice = 10000;
            let currPrice;
            let currTitle = '';
            let regexCheck = '';
            let regexLiteCheck = '';
            let regexProCheck = '';
            let topParent, parentTitle;
            for (let i = 0; i < numPrices; i++) {
                try {
                    currPrice = pricesObj[i].children[0].data.replace(/,.*/, '');
                    currPrice = currPrice.replace(',', '');
                    currPrice = currPrice.replace('.', '');
                    currPrice = currPrice.replace('€', '');
                    currPrice = currPrice.replace(/\s+/g, '');
                    currPrice = parseInt(currPrice);
                    //console.log('currprice', currPrice);
                    topParent = pricesObj[i];
                    while (topParent.attribs.class != 'display-table') {
                        topParent = topParent.parent;
                    }
                    //console.log('top parent->', topParent);
                    parentTitle = topParent;
                    while (parentTitle.attribs.class != 'product-name') {
                        parentTitle = parentTitle.children[1];
                    }
                    currTitle = parentTitle.children[1].children[0].data;
                    //console.log('currtitle', currTitle);
                    regexCheck = phoneNamePatt.test(currTitle);
                    regexLiteCheck = !litePatt.test(currTitle);
                    regexProCheck = (!proPatt.test(phoneName) && !proPatt.test(currTitle)) || (proPatt.test(phoneName) && proPatt.test(currTitle));
                    //console.log('currtitle:',currTitle);
                    //console.log(currPrice);
                    //>300 to ignore accessories
                    if (regexCheck && regexLiteCheck && regexProCheck && !isNaN(currPrice) && currPrice > 300) {
                        bestPrice = Math.min(currPrice, bestPrice);
                    }
                } catch (error) {
                    //do nothing
                }
            }
            console.log('tek4life best price:', bestPrice);
            return bestPrice == 10000 ? 'N/A' : bestPrice;
        })
        .catch(error => {
            return error;
        });
}