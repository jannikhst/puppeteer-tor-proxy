import { Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import Stealth from 'puppeteer-extra-plugin-stealth';
import AdBlock from 'puppeteer-extra-plugin-adblocker';
import Anon from 'puppeteer-extra-plugin-anonymize-ua';
import axios, { AxiosError } from 'axios';
import { TorInstance } from './tor';

puppeteer.use(Anon());
puppeteer.use(Stealth());
puppeteer.use(AdBlock());

let totalVotes = 0;
let totalAttempts = 0;
const ips = new Set<string>();
const wrongGeozoneIps = new Set<string>();


async function main() {
    const times: number[] = [];
    while (true) {
        console.log('---------------------------------');
        const start = Date.now();
        await execute();
        await wait(500);
        const end = Date.now();
        times.push(end - start);
        console.log(`Took ${end - start}ms for iteration`);
        if (times.length > 30) {
            times.shift();
        }
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`Average: ${Math.round(avg / 1000)}s`);
        const quota = totalVotes / totalAttempts;
        // in percent
        console.log(`total votes: ${totalVotes}`);
        console.log(`total attempts: ${totalAttempts}`);
        console.log(`success rate: ${Math.round(quota * 100)}%`);
        console.log('---------------------------------\n\n');
    }
}

async function execute(): Promise<void> {
    const options = { width: 1920, height: 1080 };
    let tor = await TorInstance.create(['de']);
    while (true) {
        const start = Date.now();
        if (wrongGeozoneIps.has(tor.info.ip)) {
            console.log('🟡  Had issues with this IP before, switching...');
            console.log(`removing ${tor.info.ip} from pool (blocked-count: ${wrongGeozoneIps.size})`);
            ips.delete(tor.info.ip);
            await tor.close();
            tor = await TorInstance.create();
            await wait(500);
            const end = Date.now();
            console.log(`🤖  Took ${end - start}ms to switch IP`);
        } else {
            break;
        }
    }
    const proxyUrl = tor.proxyUrl;
    const ipInfo = tor.info;
    ips.add(ipInfo.ip);
    console.log(ipInfo.info, `(Out of ${ips.size} unique ips)`);
    const headless: boolean = process.env.RUN_HEADLESS === 'true';
    const browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: [
            `--window-size=${options.width},${options.height}`,
            `--proxy-server=${proxyUrl}`,
            '--no-sandbox',
        ],
    });

    let timeouted = false;
    // define timeout for all actions
    const timeout = setTimeout(async () => {
        timeouted = true;
        console.log('❌  Timeout');
        await browser.close();
        await tor.close();
    }, 1000 * 60 * 5);

    const page = await browser.newPage();
    try {
        await performAction(page, false, tor.info.ip);
    } catch (error) {
        console.log('❌  Aborting action');
    }
    if (!timeouted) {
        clearTimeout(timeout);
        await tor.close();
        await browser.close();
    }
}
async function checkIfServerDown(page: Page): Promise<boolean> {
    // check if url is https://www.antenne.de/programm/aktionen/pausenhofkonzerte/uebersicht
    const url = page.url();
    const isDown = url === 'https://www.antenne.de/programm/aktionen/pausenhofkonzerte/uebersicht';
    return isDown;
}

async function checkIfNachtruhe(page: Page): Promise<boolean> {
    const svgElement = await page.$('svg.c-form__message-icon use[href$="#moon"]');
    const moonVisible = svgElement !== null;

    // check if text Nachtruhe is visible
    const divElement = await page.$('div.l-grid__cell.l-grid__cell--auto h3 + p');
    const nachtruheVisible = divElement !== null;

    return moonVisible && nachtruheVisible;
}

async function checkIfSuccess(page: Page): Promise<boolean> {
    const success1 = await page.$('svg.c-form__message-icon use[href$="#check"]');
    const h3Elements = await page.$$eval('h3', (elements) => {
        return elements.filter((element) => element.textContent?.trim() === 'Das hat geklappt!');
    });
    const success2 = h3Elements.length > 0;
    return success1 !== null && success2;
}

async function checkForIssue(page: Page, reason: string): Promise<boolean> {
    const success1 = await page.$('svg.c-form__message-icon use[href$="#warning"]');
    const h3Elements = await page.$$eval('h3', (elements) => {
        return elements.filter((element) => element.textContent?.trim() === 'Fehler');
    });
    const success2 = h3Elements.length > 0;
    const firstParagraphElement = await page.$('fieldset.c-form__inner p');
    const pElement = firstParagraphElement ? await page.evaluate(element => element.textContent?.trim(), firstParagraphElement) : null;
    const success3 = pElement !== null && pElement!.includes(reason);
    return success1 !== null && success2 && success3;
}


async function performAction(page: Page, loop: boolean = true, ip: string): Promise<void> {
    await page.goto('https://www.antenne.de/programm/aktionen/pausenhofkonzerte/schulen/10782-stdtisches-bertolt-brecht-gymnasium-mnchen', {
        waitUntil: 'load',
        timeout: 20000,
    });

    const nachtruhe = await checkIfNachtruhe(page);
    if (nachtruhe) {
        console.log('🌙  Nachtruhe');
        console.log('Waiting for 10 minutes');
        await wait(10 * 60 * 1000);
        return;
    }

    let status = 0;

    await page.setRequestInterception(true);
    page.on('response', async (response) => {
        try {
            const url = response.url();
            if (url.includes('danke-fuer-deine-stimme')) {
                console.log('🔵  Checking for success via page...');
                await wait(1000);
                let success = await checkIfSuccess(page);
                if (success) {
                    totalVotes++;
                    status++;
                    try {
                        axios.get('https://orcalink.de/antenne-bayern-click').then(() => {
                            console.log('✅  Voted successfully');
                        });
                    } catch (error) {
                        console.log('❌  Could not send success to orcalink.de');
                        console.log('retrying in 20 seconds');
                        await wait(20000);
                        try {
                            axios.get('https://orcalink.de/antenne-bayern-click').then(() => {
                                console.log('✅  2nd try: Voted successfully');
                            });
                        } catch (error) {
                            console.log('❌  Aborted send success after 2nd try');
                        }
                    }
                } else {
                    console.log('🔴  Checking for possible issues...');
                    const possibleReasons = [
                        'IP-Adresse außerhalb von Deutschland',
                        '1 Stimme innerhalb von 1 Minute',
                    ];
                    for (const reason of possibleReasons) {
                        success = await checkForIssue(page, reason);
                        if (success) {
                            console.log(`❌  Issue detected: ${reason}`);
                            status--;
                            if (reason === 'IP-Adresse außerhalb von Deutschland') {
                                wrongGeozoneIps.add(ip);
                            }
                            break;
                        }
                        console.log(`▸ ${reason} is not the issue`);
                    }
                }
            }
        } catch (error) {

        }
    });

    totalAttempts++;

    while (true) {
        await clickOnButtonWithText(page, 'Jetzt abstimmen');
        await waitAndClick(page, 'label.c-embed__optinbutton.c-button.has-clickhandler');
        await checkForCookieBanner(page);
        await waitAndClick(page, 'button[class="frc-button"]');

        await clickOnButtonWithText(page, 'Hier klicken zum Start');
        await checkForCookieBanner(page);
        const UNSTARTED = '.UNSTARTED';
        let value = UNSTARTED;
        while (value === UNSTARTED || value === '.UNFINISHED') {
            try {
                value = await page.$eval('.frc-captcha-solution', (el) => el.getAttribute('value')) ?? UNSTARTED;
            } catch (error) {
                await checkForCookieBanner(page);
            }
            await wait(300, 500);
        }
        await waitAndClick(page, 'button[type="submit"][id="votingButton"]');

        if (!loop) {
            const maxWaitMs = 10000;
            let x = 0;
            // wait till votesInThisSession is greater than 0
            while (status === 0 && x < maxWaitMs) {
                await wait(200);
                x += 200;
            }
            return;
        } else {
            await wait(61000, 64000);
        }
    }
}


async function checkForCookieBanner(page: Page) {
    try {
        const parentElement = await page.$('#usercentrics-root');
        const shadowRoot = await page.evaluateHandle(parent => parent!.shadowRoot, parentElement);
        const targetElement = await shadowRoot.asElement()!.$('button[data-testid="uc-accept-all-button"]');
        await targetElement!.click();
        console.log('removed cookie banner');
        const down = await checkIfServerDown(page);
        if (down) {
            console.log('Server down, waiting 2 minutes');
            await page.close();
            await wait(2 * 60 * 1000);
        }
    } catch (error) {
    }
}

async function waitAndClick(page: Page, selector: string, timeout: number = 10000) {
    try {
        await page.waitForSelector(selector, {
            timeout,
            visible: true,
        });
        await wait(800);
        await checkForCookieBanner(page);
        await page.click(selector);
        wait(500);
    } catch (error) {
        console.log(`🟡  Error while waiting for selector ${selector}, ${error}`);
    }
}


async function clickOnButtonWithText(page: Page, text: string): Promise<boolean> {
    await checkForCookieBanner(page);
    var buttons = await page.$$('button');
    for (var i = 0; i < buttons.length; i++) {
        var buttonInnerText = await buttons[i].evaluate(node => node.innerText);
        if (buttonInnerText) {
            if (buttonInnerText.trim() === text) {
                await buttons[i].click();
                return true;
            }
        }
    }
    return false;
}



function wait(minDelay: number, maxDelay?: number, callback?: (handler: NodeJS.Timeout) => void): Promise<void> {
    const delay = maxDelay ? Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay : minDelay;
    return new Promise((resolve) => {
        const handler = setTimeout(() => {
            if (callback) {
                callback(handler);
            }
            resolve();
        }, delay);
    });
}


main().catch(console.error);




