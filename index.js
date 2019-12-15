const express = require('express');
const app = express();
const rp = require('request-promise');
const $ = require('cheerio');
const cors = require('cors');
//url for Techradar top rated phones
const trTopRatedPhonesURL = 'https://www.techradar.com/uk/news/best-phone';

//const whitelist = ['localhost'];
const corsOptions = {
    origin: function (origin, callback) {
        console.log(origin);
        return callback(null, true);
    }
}

app.all('/', cors(corsOptions), function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

app.get('/phones', async (req, res) => {
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
    // phonesList[5].tek4life = await getPriceByShop(phonesList[5].name, 'tek4life');
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
    //console.log(phoneName);
    return rp(options)
        .then(htmlPrices => {
            let pricesObj = $('div.w-product__content .w-currentPrice .w-product-price__main', htmlPrices);
            //console.log(pricesObj[0].children[0].data);
            //let title = pricesObj[0].parent.parent.parent.parent.children[0].children[0].children[0].children[0].data;
            //console.log('parent:',title);
            //console.log(phoneNamePatt.test(title));
            let numPrices = pricesObj.length;
            //console.log('numprices:',numPrices);
            let bestPrice = 10000;
            let currPrice = 10000;
            let currTitle = '';
            let regexCheck = '';
            let regexLiteCheck = '';
            let numPrices2 = '';
            for (let i = 0; i < numPrices; i++) {
                try {
                    numPrices2 = pricesObj[i].children.length;
                    //console.log('numPrices2:',numPrices2);
                    for (let j = 0; j < numPrices2; j++) {
                        currPrice = parseInt(pricesObj[i].children[j].data);
                        if (!isNaN(currPrice)) {
                            //console.log('value found');
                            break;
                        }
                    }
                    currTitle = pricesObj[i].parent.parent.parent.parent.children[0].children[0].children[0].children[0].data;
                    regexCheck = phoneNamePatt.test(currTitle);
                    regexLiteCheck = litePatt.test(currTitle);
                    //console.log('currtitle:',currTitle);
                    //console.log(currPrice);
                    //>200 to ignore accessories
                    if (regexCheck && !regexLiteCheck && currPrice > 200) {
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
    //console.log(phoneName);
    return rp(options)
        .then(htmlPrices => {
            let pricesObj = $('.category-products span.price', htmlPrices);
            // let topParent = pricesObj[0];
            // while (topParent.attribs.class != 'display-table') {
            //     topParent = topParent.parent;
            // }
            // console.log('top parent->', topParent);
            // let parentTitle = topParent;
            // while (parentTitle.attribs.class != 'product-name') {
            //     parentTitle = parentTitle.children[1];
            // }
            // let title = parentTitle.children[1].children[0].data;
            // console.log('parent title ->', title);
            //console.log(phoneNamePatt.test(title));
            let numPrices = pricesObj.length;
            //console.log('numprices:', numPrices);
            let bestPrice = 10000;
            let currPrice;
            let currTitle = '';
            let regexCheck = '';
            let regexLiteCheck = '';
            let topParent, parentTitle;
            for (let i = 0; i < numPrices; i++) {
                try {
                    currPrice = parseInt(pricesObj[i].children[0].data);
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
                    regexLiteCheck = litePatt.test(currTitle);
                    //console.log('currtitle:',currTitle);
                    //console.log(currPrice);
                    //>200 to ignore accessories
                    if (regexCheck && !regexLiteCheck && !isNaN(currPrice) && currPrice > 300) {
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