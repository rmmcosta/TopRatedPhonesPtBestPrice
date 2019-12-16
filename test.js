const express = require('express');
const app = express();
const rp = require('request-promise');
const $ = require('cheerio');
const cors = require('cors');
const schedule = require('node-schedule');
const fs = require('fs');

app.get('/test', (req, res) => {
    writePhonePrices2File();
    res.send('start creating file.');
});

async function writePhonePrices2File() {
    const phoneList = await getTopRatedPhones();
    const testevidences = await getBestPrices(phoneList);
    fs.writeFile('test.txt', testevidences, function (err) {
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
    let testevidences = '{"phoneName":' + phonesList[2].name + '}' + await getPriceByShop(phonesList[2].name, 'tek4life');
    // for (let i = 0; i < phonesList.length; i++) {
    //     phonesList[i].worten = await getPriceByShop(phonesList[i].name, 'worten');
    //     phonesList[i].tek4life = await getPriceByShop(phonesList[i].name, 'tek4life');
    // }
    return testevidences;
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
    let testevidences = '';
    switch (shop) {
        case 'tek4life':
            testevidences = await getTek4LifeBestPrice(options, phoneName);
            break;
        default:
            break;
    }
    return testevidences;
}

async function getTek4LifeBestPrice(options, phoneName) {
    const phoneNamePatt = new RegExp('\\b' + phoneName + '\\b', 'i');
    const litePatt = new RegExp('\\bLite\\b', 'i');
    let testevidences = '{"phonename": "' + phoneName + '"\n\n';
    return rp(options)
        .then(htmlPrices => {
            let pricesObj = $('.category-products span.price', htmlPrices);
            testevidences += ',' + pricesObj;
            let numPrices = pricesObj.length;
            let bestPrice = 10000;
            let currPrice;
            let currTitle = '';
            let regexCheck = '';
            let regexLiteCheck = '';
            let topParent, parentTitle;
            for (let i = 0; i < numPrices; i++) {
                try {
                    testevidences += ',"currprice":"' + pricesObj[i].children[0].data + '",';
                    currPrice = pricesObj[i].children[0].data.replace(',00', '');
                    currPrice = currPrice.replace(',', '');
                    currPrice = currPrice.replace('.', '');
                    currPrice = currPrice.replace('€', '');
                    currPrice = currPrice.replace(/\s+/g, '');
                    testevidences += ',"currprice after replaces":"' + currPrice;
                    currPrice = parseInt(currPrice);
                    testevidences += ',"currprice":"' + currPrice + '",';
                    //console.log('currprice', currPrice);
                    topParent = pricesObj[i];
                    testevidences += ',"topparent":"' + topParent + '",';
                    while (topParent.attribs.class != 'display-table') {
                        topParent = topParent.parent;
                    }
                    //console.log('top parent->', topParent);
                    parentTitle = topParent;
                    testevidences += ',"parentTitle":"' + parentTitle + '",';
                    while (parentTitle.attribs.class != 'product-name') {
                        parentTitle = parentTitle.children[1];
                    }
                    currTitle = parentTitle.children[1].children[0].data;
                    testevidences += ',"currTitle":"' + currTitle + '",';
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
            //console.log('tek4life best price:', bestPrice);
            return testevidences;
        })
        .catch(error => {
            return error;
        });
}