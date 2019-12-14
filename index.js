const express = require('express');
const app = express();
const rp = require('request-promise');
const $ = require('cheerio');
//url for Techradar top rated phones
const trTopRatedPhonesURL = 'https://www.techradar.com/uk/news/best-phone';

app.get('/phones', async (req, res) => {
    const phoneList = await getTopRatedPhones();
    const priceList = await getBestPrices(phoneList);
    let html = '<h2>Best phones and prices</h2><hr><br><table style="border: 1px solid black; text-align:left; padding:5px;"><tr style="background-color:#46A049;padding:5px;"><th style="padding:5px; color:white;">Phone</th><th style="padding:5px; color:white;">Price</th></tr>';
    priceList.forEach(phone => {
        html = html +'<tr style="border-bottom: 1px solid gray; background-color:white; padding: 5px;"><td style="padding:5px;">' + phone.name + '</td><td style="padding:5px;">' + phone.price + ' €</td></tr>';
    });
    html = html + '</table>';
    res.send(html);
});

app.listen(3000);

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
                namesArray.push({ name: phoneName, price: 'N/A' });
                //console.log($('#article-body ol li',htmlString)[2].children[0].children[0].data);
                for (let i = 1; i < numOfTopRatedPhones; i++) {
                    //console.log(topRatedPhonesArray[i]);
                    phoneName = topRatedPhonesArray[i].children[0].children[0].data;
                    if (phoneName.indexOf('/') > 0) {
                        phoneName = phoneName.substr(0, phoneName.indexOf('/'));
                    }
                    namesArray.push({ name: phoneName, price: 'N/A' });
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
    for(let i=0;i<phonesList.length;i++){
        phonesList[i].price = await getPriceByShop(phonesList[i].name, 'worten');
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
    let bestPrice = await getWortenBestPrice(options, phoneName);
    console.log(bestPrice);
    return bestPrice;
}

async function getWortenBestPrice(options, phoneName) {
    const phoneNamePatt = new RegExp('\\b' + phoneName + '\\b', 'i');
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
            let numPrices2 = '';
            for (let i = 0; i < numPrices; i++) {
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
                //console.log('currtitle:',currTitle);
                //console.log(currPrice);
                //>200 to ignore accessories
                if (regexCheck && currPrice > 200) {
                    bestPrice = Math.min(currPrice, bestPrice);
                }
            }
            //console.log(bestPrice);
            return bestPrice == 10000 ? 'N/A' : bestPrice;
        })
        .catch(error => {
            return error;
        });
}