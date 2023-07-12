import useProxy from "puppeteer-page-proxy";
import { checkForCookieBanner, checkForIssue, checkIfSuccess, clickOnButtonWithText, getIssue, wait, waitAndClick } from "./action";
import { Stats, buildBrowser } from "./app";
import { IpWorker, reportAlreadyUsed, reportGeoIssue } from "./ip_worker";
import axios from "axios";


let start = Date.now();
const ipWorker = new IpWorker();

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


async function getOwnIp(): Promise<string> {
    const res = await axios.get('http://ip-api.com/json/');
    return res.data.query;
}


async function stickySession(stats: Stats) {
    const ownIp = await getOwnIp();
    console.log('Starting at', ownIp);
    const browser = await buildBrowser();
    const page = await browser.newPage();
    await ipWorker.prepareConnections(5);
    start = Date.now();

    let tor = await ipWorker.getUnusedInstance(58000);
    if (!tor.isMocked) {
        await useProxy(page, tor.proxyUrl);
    }
    await wait(1000);
    await page.goto('https://www.antenne.de/programm/aktionen/pausenhofkonzerte/schulen/10782-stdtisches-bertolt-brecht-gymnasium-mnchen', {
        waitUntil: 'load',
        timeout: 30000,
    });
    await clickOnButtonWithText(page, 'Jetzt abstimmen');
    await wait(1000);


    await page.setRequestInterception(true);


    async function waitIllCloseable(ip: string) {
        while (tor.info.ip === ip) {
            await wait(1000);
        }
        ipWorker.closeInstance(ip);
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
                                await reportGeoIssue(tor.info.ip);
                                waitIllCloseable(tor.info.ip);
                                ipWorker.prepareConnections(1);
                                detected = true;
                            }
                            if (reason === REASON_ALREADY_USED) {
                                await reportAlreadyUsed(tor.info.ip);
                                // flip a coin to decide if we should close the instance
                                if (Math.random() > 0.5) {
                                    waitIllCloseable(tor.info.ip);
                                    await ipWorker.prepareConnections(1);
                                }
                                if (Math.random() > 0.7) {
                                    await ipWorker.prepareConnections(1);
                                }
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
                            return;
                        }
                        console.log(`❌  this might be the issue: ${issue}`);
                    }
                }
            }
        } catch (error) {
            console.log('❌  Error while checking for success');
            console.log(error);
        }
    });


    page.on('dialog', async dialog => {
        console.log('❌  Dialog detected');
        console.log(dialog.message());
        await dialog.dismiss();
    });



    while (true) {
        const success = await waitAndClick(page, 'label.c-embed__optinbutton.c-button.has-clickhandler', 25000);
        if (!success) {
            await waitAndClick(page, 'button[id="voteAgainButton"]', 5000);
            await waitAndClick(page, 'label.c-embed__optinbutton.c-button.has-clickhandler', 4000);
        }
        await checkForCookieBanner(page);
        await waitAndClick(page, 'button[class="frc-button"]', 5000);
        await clickOnButtonWithText(page, 'Hier klicken zum Start');
        await checkForCookieBanner(page);
        const UNSTARTED = '.UNSTARTED';
        let value = UNSTARTED;
        let x = 0;
        while ((value === UNSTARTED || value === '.UNFINISHED' || value === '.FETCHING') && x < 80) {
            x++;
            try {
                value = await page.$eval('.frc-captcha-solution', (el) => el.getAttribute('value')) ?? UNSTARTED;
            } catch (error) {
                await checkForCookieBanner(page);
            }
            await wait(500);
        }
        wait(1000);
        await waitAndClick(page, 'button[type="submit"][id="votingButton"]', 5000);
        try {
            await page.waitForSelector('#voteAgainButton', {
                timeout: 10000,
                visible: true,
            });
        } catch (error) {
            console.log('❌  Could not find voteAgainButton');
        }
        const button = await page.$('#voteAgainButton');
        await button?.evaluate((element) => {
            element.classList.remove('disabled');
        });
        tor = await ipWorker.getUnusedInstance(58000, ownIp);
        if (!tor.isMocked) {
            await useProxy(page, tor.proxyUrl);
        }
        await waitAndClick(page, 'button[id="voteAgainButton"]', 15000);
    }
}


const stats: Stats = {
    totalVotes: 0,
    totalAttempts: 0,
};

stickySession(stats).catch(console.error);

setInterval(() => {
    const duration = Date.now() - start;
    const votesPerMinute = stats.totalVotes / (duration / 1000 / 60);
    // round with 2 digits
    const durationRounded = Math.round(duration / 1000 / 60 * 100) / 100;
    const votesPerMinuteRounded = Math.round(votesPerMinute * 100) / 100;
    console.log(`📊  Stats: ${stats.totalVotes} votes in ${durationRounded} minutes (${votesPerMinuteRounded} votes per minute)`);
}, 10000);