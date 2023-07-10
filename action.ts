import axios from "axios";
import { Page } from "puppeteer";
import { Stats } from "./app";
import { reportAlreadyUsed, reportGeoIssue } from "./ip_worker";
import fs from 'fs/promises';

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

async function getIssue(page: Page): Promise<string> {
    const firstParagraphElement = await page.$('fieldset.c-form__inner p');
    const pElement = firstParagraphElement ? await page.evaluate(element => element.textContent?.trim(), firstParagraphElement) : undefined;
    return pElement || '';
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


export async function performAction(page: Page, loop: boolean = true, ip: string, stats: Stats): Promise<void> {


    await page.setRequestInterception(true);

    const blockResourceType = ["image", "media", "font"];
    const blockResourceName = [
        "quantserve",
        "adzerk",
        "doubleclick",
        "adition",
        "exelator",
        "sharethrough",
        "cdn.api.twitter",
        "google-analytics",
        "googletagmanager",
        "google",
        "fontawesome",
        "facebook",
        "analytics",
        "optimizely",
        "clicktale",
        "mixpanel",
        "zedo",
        "clicksor",
        "tiqcdn",
    ];

    page.on("request", (request) => {
        const requestUrl = request.url();
        if (!request.isInterceptResolutionHandled())
          if (
            blockResourceType.includes(request.resourceType()) ||
            blockResourceName.some((resource) => requestUrl.includes(resource))
          ) {
            request.abort();
            console.log("🚫  Aborted request:", requestUrl);
          } else {
            request.continue();
          }
      });

    await page.goto('https://www.antenne.de/programm/aktionen/pausenhofkonzerte/schulen/10782-stdtisches-bertolt-brecht-gymnasium-mnchen', {
        waitUntil: 'load',
        timeout: 30000,
    });

    const nachtruhe = await checkIfNachtruhe(page);
    if (nachtruhe) {
        console.log('🌙  Nachtruhe');
        console.log('Waiting for 10 minutes');
        await wait(5 * 60 * 1000);
        return;
    }

    let status = 0;


    function voteSuccess() {
        axios.get('https://orcalink.de/antenne-bayern-2').then(() => {
            console.log('✅  Voted successfully');
        }).catch(() => {
            console.log('❌  Could not send success to orcalink.de');
            console.log('retrying in 20 seconds');
            wait(20000).then(() => {
                axios.get('https://orcalink.de/antenne-bayern-2').then(() => {
                    console.log('✅  2nd try: Voted successfully');
                }).catch(() => {
                    console.log('❌  Aborted send success after 2nd try');
                });
            });
        });
    }



    page.on('response', async (response) => {
        try {
            const url = response.url();
            if (url.includes('danke-fuer-deine-stimme')) {
                console.log('🔵  Checking for success via page...');
                await wait(1000);
                let success = await checkIfSuccess(page);
                if (success) {
                    stats.totalVotes++;
                    status++;
                    voteSuccess();
                } else {
                    console.log('🔴  Checking for possible issues...');
                    const REASON_GEO = 'IP-Adresse außerhalb von Deutschland';
                    const REASON_ALREADY_USED = '1 Stimme innerhalb von 1 Minute';
                    const possibleReasons = [
                        REASON_GEO,
                        REASON_ALREADY_USED,
                    ];
                    let detected = false;
                    for (const reason of possibleReasons) {
                        success = await checkForIssue(page, reason);
                        if (success) {
                            console.log(`❌  Issue detected: ${reason}`);
                            if (reason === REASON_GEO) {
                                await reportGeoIssue(ip);
                                detected = true;
                            }
                            if (reason === REASON_ALREADY_USED) {
                                await reportAlreadyUsed(ip);
                                detected = true;
                            }
                            break;
                        }
                        console.log(`▸ ${reason} is not the issue`);
                    }
                    if (!detected) {
                        console.log('❌  Could not detect issue');
                        const issue = await getIssue(page);
                        const successreason = 'Wir haben deine Stimme gezählt.'
                        if (issue.includes(successreason)) {
                            console.log('No issues detected, html is just weird 😅');
                            voteSuccess();
                            stats.totalVotes++;
                            status++;
                        }
                        console.log(`❌  this might be the issue: ${issue}`);
                    }
                    status--;
                }
            }
        } catch (error) {
            console.log('❌  Error while checking for success');
            console.log(error);
        }
    });

    stats.totalAttempts++;

    while (true) {
        await clickOnButtonWithText(page, 'Jetzt abstimmen');
        await wait(1000);
        const success = await waitAndClick(page, 'label.c-embed__optinbutton.c-button.has-clickhandler', 34000);
        if (!success) {
            console.log('❌  Could not click consent button');
            throw new Error("consent button not found");
        }
        await checkForCookieBanner(page);
        await waitAndClick(page, 'button[class="frc-button"]', 15000);

        await clickOnButtonWithText(page, 'Hier klicken zum Start');
        await checkForCookieBanner(page);
        const UNSTARTED = '.UNSTARTED';
        let value = UNSTARTED;
        let x = 0;
        while ((value === UNSTARTED || value === '.UNFINISHED') && x < 100) {
            x++;
            try {
                value = await page.$eval('.frc-captcha-solution', (el) => el.getAttribute('value')) ?? UNSTARTED;
            } catch (error) {
                await checkForCookieBanner(page);
            }
            await wait(500);
        }
        await waitAndClick(page, 'button[type="submit"][id="votingButton"]', 15000);

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

async function waitAndClick(page: Page, selector: string, timeout: number = 15000): Promise<boolean> {
    try {
        await page.waitForSelector(selector, {
            timeout,
            visible: true,
        });
        await wait(800);
        await checkForCookieBanner(page);
        await page.click(selector);
        wait(500);
        return true;
    } catch (error) {
        console.log(`🟡  Error while waiting for selector ${selector}, ${error}`);
        return false;
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



export function wait(minDelay: number, maxDelay?: number, callback?: (handler: NodeJS.Timeout) => void): Promise<void> {
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